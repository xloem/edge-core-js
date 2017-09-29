// @flow

import {
  addCurrencyWallet,
  renameCurrencyWallet,
  setCurrencyWalletTxMetadata,
  setupNewTxMetadata
} from '../redux/actions.js'
import {
  getCurrencyWalletBalance,
  getCurrencyWalletBlockHeight,
  getCurrencyWalletEngine,
  getCurrencyWalletFiat,
  getCurrencyWalletFiles,
  getCurrencyWalletName,
  getCurrencyWalletPlugin,
  getCurrencyWalletProgress,
  getCurrencyWalletTxList,
  getCurrencyWalletTxs,
  getStorageWalletLastSync
} from '../redux/selectors.js'
import { makeStorageWalletApi } from '../storage/storageApi.js'
import { copyProperties, wrapObject } from '../util/api.js'
import { createReaction } from '../util/redux/reaction.js'
import { compare } from '../util/compare.js'
import { filterObject, mergeDeeply } from '../util/util.js'
import type {
  AbcReceiveAddress,
  AbcWalletInfo,
  AbcSpendInfo,
  AbcTransaction,
  AbcMetadata,
  AbcParsedUri
} from 'airbitz-core-types'

function nop (nopstuff: any) {}

const fakeMetadata = {
  bizId: 0,
  category: '',
  exchangeAmount: {},
  name: '',
  notes: ''
}

/**
 * Creates a `CurrencyWallet` API object.
 */
export function makeCurrencyWallet (keyInfo: AbcWalletInfo, opts: any) {
  const { coreRoot, callbacks = {} } = opts
  const { redux } = coreRoot

  return redux
    .dispatch(addCurrencyWallet(keyInfo, opts))
    .then(keyId =>
      wrapObject(
        coreRoot.onError,
        'CurrencyWallet',
        makeCurrencyApi(redux, keyInfo, callbacks)
      )
    )
}

/**
 * Creates an unwrapped account API object around an account state object.
 */
export function makeCurrencyApi (
  redux: any,
  keyInfo: AbcWalletInfo,
  callbacks: any
) {
  const { dispatch, getState } = redux
  const keyId = keyInfo.id

  // Bound selectors:
  const engine = () => getCurrencyWalletEngine(getState(), keyId)
  const plugin = () => getCurrencyWalletPlugin(getState(), keyId)

  const {
    onAddressesChecked,
    onBalanceChanged,
    onBlockHeightChanged,
    onDataChanged,
    onNewTransactions = nop,
    onTransactionsChanged = nop,
    onWalletNameChanged
  } = callbacks

  // Hook up engine callbacks:
  if (onAddressesChecked) {
    dispatch(
      createReaction(
        state => getCurrencyWalletProgress(state, keyId),
        onAddressesChecked
      )
    )
  }

  if (onBalanceChanged) {
    dispatch(
      createReaction(
        state => getCurrencyWalletBalance(state, keyId),
        balance => {
          if (balance.currencyCode != null) {
            onBalanceChanged(balance.currencyCode, balance.balance)
          }
        }
      )
    )
  }

  if (onBlockHeightChanged) {
    dispatch(
      createReaction(
        state => getCurrencyWalletBlockHeight(state, keyId),
        onBlockHeightChanged
      )
    )
  }

  // Hook up storage callback:
  if (onDataChanged) {
    dispatch(
      createReaction(
        state => getStorageWalletLastSync(state, keyId),
        timestamp => onDataChanged()
      )
    )
  }

  // Hook up the `onTransactionsChanged` and `onNewTransactions` callbacks:
  let inhibit = false
  dispatch(
    createReaction(
      state => getCurrencyWalletFiles(state, keyId),
      state => getCurrencyWalletTxs(state, keyId),
      state => getCurrencyWalletTxList(state, keyId),
      state => getCurrencyWalletFiat(state, keyId),
      state => getCurrencyWalletPlugin(state, keyId).currencyInfo.currencyCode,
      (
        files,
        txs,
        list,
        walletFiat,
        walletCurrency,
        oldFiles = {},
        oldTxs = {}
      ) => {
        if (inhibit) return
        inhibit = true

        const changes = []
        const created = []

        // Diff the transaction list:
        for (const info of list) {
          const tx = txs[info.txid]
          const file = files[info.txid]

          if (
            !compare(tx, oldTxs[info.txid]) ||
            !compare(file, oldFiles[info.txid])
          ) {
            // If we have no metadata, it's new:
            if (file == null) {
              dispatch(setupNewTxMetadata(keyId, tx))
              prepareTxForCallback(
                walletCurrency,
                walletFiat,
                tx,
                file,
                created
              )
            } else {
              prepareTxForCallback(
                walletCurrency,
                walletFiat,
                tx,
                file,
                changes
              )
            }
          }
        }

        if (changes.length) onTransactionsChanged(changes)
        if (created.length) onNewTransactions(created)
        inhibit = false
      }
    )
  )

  // Hook up the `onWalletNameChanged` callback:
  if (onWalletNameChanged) {
    dispatch(
      createReaction(
        state => getCurrencyWalletName(state, keyId),
        onWalletNameChanged
      )
    )
  }

  const out = {
    // Storage stuff:
    get name () {
      return getCurrencyWalletName(getState(), keyId)
    },
    renameWallet (name: string) {
      return dispatch(renameCurrencyWallet(keyId, name))
    },

    // Currency info:
    get fiatCurrencyCode (): string {
      return getCurrencyWalletFiat(getState(), keyId)
    },
    get currencyInfo () {
      return plugin().currencyInfo
    },

    // Running state:
    startEngine () {
      return engine().startEngine()
    },

    stopEngine (): Promise<void> {
      return Promise.resolve(engine().killEngine())
    },

    enableTokens (tokens: Array<string>) {
      return engine().enableTokens(tokens)
    },

    // Transactions:
    '@getBalance': { sync: true },
    getBalance (opts: any) {
      return engine().getBalance(opts)
    },

    '@getBlockHeight': { sync: true },
    getBlockHeight () {
      return engine().getBlockHeight()
    },

    getTransactions (opts: any = {}): Promise<Array<AbcTransaction>> {
      const state = getState()
      const files = getCurrencyWalletFiles(state, keyId)
      const list = getCurrencyWalletTxList(state, keyId)
      const txs = getCurrencyWalletTxs(state, keyId)
      const fiat = getCurrencyWalletFiat(state, keyId)
      const defaultCurrency = plugin().currencyInfo.currencyCode
      const currencyCode = opts.currencyCode || defaultCurrency

      const out = []
      for (const info of list) {
        const tx = txs[info.txid]
        const file = files[info.txid]

        // Skip irrelevant transactions:
        if (!tx.nativeAmount[currencyCode] && !tx.networkFee[currencyCode]) {
          continue
        }

        out.push(
          combineTxWithFile(defaultCurrency, fiat, tx, file, currencyCode)
        )
      }

      // TODO: Handle the sort within the tx list merge process:
      return Promise.resolve(out.sort((a, b) => a.date - b.date))
    },

    getReceiveAddress (opts: any): Promise<AbcReceiveAddress> {
      const abcReceiveAddress: AbcReceiveAddress = engine.getFreshAddress(opts)
      abcReceiveAddress.nativeAmount = '0'
      abcReceiveAddress.metadata = fakeMetadata
      return Promise.resolve(abcReceiveAddress)
    },

    saveReceiveAddress (receiveAddress: AbcReceiveAddress): Promise<void> {
      return Promise.resolve()
    },

    lockReceiveAddress (receiveAddress: AbcReceiveAddress): Promise<void> {
      return Promise.resolve()
    },

    '@makeAddressQrCode': { sync: true },
    makeAddressQrCode (address: AbcReceiveAddress) {
      return address.publicAddress
    },

    '@makeAddressUri': { sync: true },
    makeAddressUri (address: AbcReceiveAddress) {
      return address.publicAddress
    },

    makeSpend (spendInfo: AbcSpendInfo): Promise<AbcTransaction> {
      return engine().makeSpend(spendInfo)
    },

    signTx (tx: AbcTransaction): Promise<AbcTransaction> {
      return engine().signTx(tx)
    },

    broadcastTx (tx: AbcTransaction): Promise<AbcTransaction> {
      return engine().broadcastTx(tx)
    },

    saveTx (tx: AbcTransaction) {
      return Promise.all([engine().saveTx(tx)])
    },

    saveTxMetadata (txid: string, currencyCode: string, metadata: AbcMetadata) {
      const fiat = getCurrencyWalletFiat(getState(), keyId)

      return dispatch(
        setCurrencyWalletTxMetadata(
          keyId,
          txid,
          currencyCode,
          fixMetadata(metadata, fiat)
        )
      )
    },

    getMaxSpendable (spendInfo: AbcSpendInfo): Promise<string> {
      return Promise.resolve('0')
    },

    sweepPrivateKey (keyUri: string): Promise<void> {
      return Promise.resolve()
    },

    '@parseUri': { sync: true },
    parseUri (uri: string) {
      return plugin().parseUri(uri)
    },

    '@encodeUri': { sync: true },
    encodeUri (obj: AbcParsedUri) {
      return plugin().encodeUri(obj)
    }
  }
  copyProperties(out, makeStorageWalletApi(redux, keyInfo, callbacks))

  return out
}

function fixMetadata (metadata: AbcMetadata, fiat: any) {
  const out = filterObject(metadata, [
    'bizId',
    'category',
    'exchangeAmount',
    'name',
    'notes'
  ])

  if (metadata.amountFiat != null) {
    if (out.exchangeAmount == null) out.exchangeAmount = {}
    out.exchangeAmount[fiat] = metadata.amountFiat
  }

  return out
}

function combineTxWithFile (
  walletCurrency: any,
  walletFiat: any,
  tx: any,
  file: any,
  currencyCode: string
) {
  // Copy the tx properties to the output:
  const out = {
    ...tx,
    amountSatoshi: Number(tx.nativeAmount[currencyCode]),
    nativeAmount: tx.nativeAmount[currencyCode],
    networkFee: tx.networkFee[currencyCode]
  }

  // These are our fallback values:
  const fallbackFile = {
    currencies: {}
  }
  fallbackFile.currencies[walletCurrency] = {
    providerFreeSent: 0,
    metadata: {
      name: '',
      category: '',
      notes: '',
      bizId: 0,
      exchangeAmount: {}
    }
  }

  // Copy the appropriate metadata to the output:
  if (file) {
    const merged = mergeDeeply(
      fallbackFile,
      file.currencies[walletCurrency],
      file.currencies[currencyCode]
    )

    if (file.creationDate < out.date) out.date = file.creationDate
    out.providerFee = merged.providerFeeSent
    out.metadata = merged.metadata
    out.metadata.amountFiat = merged.metadata.exchangeAmount[walletFiat]
  }

  return out
}

function prepareTxForCallback (
  walletCurrency: any,
  walletFiat: any,
  tx: any,
  file: any,
  array: any
) {
  const currencies = Object.keys(tx.nativeAmount)
  for (const currency of currencies) {
    array.push(
      combineTxWithFile(walletCurrency, walletFiat, tx, file, currency)
    )
  }
}
