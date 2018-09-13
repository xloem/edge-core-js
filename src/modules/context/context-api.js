// @flow

import type {
  EdgeAccount,
  EdgeAccountOptions,
  EdgeContext,
  EdgeEdgeLoginOptions,
  EdgeEdgeLoginRequest,
  EdgeExchangeSwapInfo,
  EdgeLoginMessages,
  EdgePasswordRules
} from '../../edge-core-index.js'
import { wrapObject } from '../../util/api.js'
import { base58 } from '../../util/encoding.js'
import { makeAccount } from '../account/account-init.js'
import { makeShapeshiftApi } from '../exchange/shapeshift.js'
import { createLogin, usernameAvailable } from '../login/create.js'
import { requestEdgeLogin } from '../login/edge.js'
import { fixUsername, getStash } from '../login/login-selectors.js'
import { fetchLoginMessages, makeLoginTree, resetOtp } from '../login/login.js'
import { removeStash } from '../login/loginStore.js'
import { checkPasswordRules, loginPassword } from '../login/password.js'
import { getPin2Key, loginPin2 } from '../login/pin2.js'
import {
  getQuestions2,
  getRecovery2Key,
  listRecoveryQuestionChoices,
  loginRecovery2
} from '../login/recovery2.js'
import type { ApiInput } from '../root.js'
import { EdgeInternalStuff } from './internal-api.js'

export function makeContextApi (ai: ApiInput) {
  const appId = ai.props.state.login.appId
  const internalApi = new EdgeInternalStuff(ai)

  const shapeshiftApi = makeShapeshiftApi(ai)

  const rawContext: EdgeContext = {
    appId,

    get _internalEdgeStuff (): EdgeInternalStuff {
      return internalApi
    },

    '@fixUsername': { sync: true },
    fixUsername (username: string): string {
      return fixUsername(username)
    },

    async listUsernames (): Promise<Array<string>> {
      return Object.keys(ai.props.state.login.stashes)
    },

    async deleteLocalAccount (username: string): Promise<mixed> {
      // Safety check:
      const fixedName = fixUsername(username)
      for (const accountId of ai.props.state.accountIds) {
        if (ai.props.state.accounts[accountId].username === fixedName) {
          throw new Error('Cannot remove logged-in user')
        }
      }

      return removeStash(ai, username)
    },

    async usernameAvailable (username: string): Promise<boolean> {
      return usernameAvailable(ai, username)
    },

    async createAccount (
      username: string,
      password?: string,
      pin?: string,
      opts?: EdgeAccountOptions
    ): Promise<EdgeAccount> {
      const { callbacks } = opts || {} // opts can be `null`

      return createLogin(ai, username, {
        password,
        pin
      }).then(loginTree => {
        return makeAccount(ai, appId, loginTree, 'newAccount', callbacks)
      })
    },

    async loginWithKey (
      username: string,
      loginKey: string,
      opts?: EdgeAccountOptions
    ): Promise<EdgeAccount> {
      const { callbacks } = opts || {} // opts can be `null`

      const stashTree = getStash(ai, username)
      const loginTree = makeLoginTree(stashTree, base58.parse(loginKey), appId)
      return makeAccount(ai, appId, loginTree, 'keyLogin', callbacks)
    },

    async loginWithPassword (
      username: string,
      password: string,
      opts?: EdgeAccountOptions
    ): Promise<EdgeAccount> {
      const { callbacks, otp } = opts || {} // opts can be `null`

      return loginPassword(ai, username, password, otp).then(loginTree => {
        return makeAccount(ai, appId, loginTree, 'passwordLogin', callbacks)
      })
    },

    '@checkPasswordRules': { sync: true },
    checkPasswordRules (password): EdgePasswordRules {
      return checkPasswordRules(password)
    },

    async pinLoginEnabled (username: string): Promise<boolean> {
      const loginStash = getStash(ai, username)
      const pin2Key = getPin2Key(loginStash, appId)
      return pin2Key && pin2Key.pin2Key != null
    },

    async loginWithPIN (
      username: string,
      pin: string,
      opts?: EdgeAccountOptions
    ): Promise<EdgeAccount> {
      const { callbacks, otp } = opts || {} // opts can be `null`

      return loginPin2(ai, appId, username, pin, otp).then(loginTree => {
        return makeAccount(ai, appId, loginTree, 'pinLogin', callbacks)
      })
    },

    async getRecovery2Key (username: string): Promise<string> {
      const loginStash = getStash(ai, username)
      const recovery2Key = getRecovery2Key(loginStash)
      if (recovery2Key == null) {
        throw new Error('No recovery key stored locally.')
      }
      return base58.stringify(recovery2Key)
    },

    async loginWithRecovery2 (
      recovery2Key: string,
      username: string,
      answers: Array<string>,
      opts?: EdgeAccountOptions
    ): Promise<EdgeAccount> {
      const { callbacks, otp } = opts || {} // opts can be `null`

      return loginRecovery2(
        ai,
        base58.parse(recovery2Key),
        username,
        answers,
        otp
      ).then(loginTree => {
        return makeAccount(ai, appId, loginTree, 'recoveryLogin', callbacks)
      })
    },

    async fetchRecovery2Questions (
      recovery2Key: string,
      username: string
    ): Promise<Array<string>> {
      return getQuestions2(ai, base58.parse(recovery2Key), username)
    },

    async listRecoveryQuestionChoices (): Promise<Array<string>> {
      return listRecoveryQuestionChoices(ai)
    },

    async requestEdgeLogin (
      opts: EdgeEdgeLoginOptions
    ): Promise<EdgeEdgeLoginRequest> {
      const {
        callbacks,
        onLogin,
        displayImageUrl,
        displayName,
        onProcessLogin
      } = opts

      return requestEdgeLogin(ai, appId, {
        displayImageUrl,
        displayName,
        onProcessLogin,
        onLogin (err, loginTree) {
          if (err || !loginTree) return onLogin(err)
          makeAccount(ai, appId, loginTree, 'edgeLogin', callbacks).then(
            account => onLogin(void 0, account),
            err => onLogin(err)
          )
        }
      })
    },

    async requestOtpReset (
      username: string,
      otpResetToken: string
    ): Promise<Date> {
      return resetOtp(ai, username, otpResetToken)
    },

    async fetchLoginMessages (): Promise<EdgeLoginMessages> {
      return fetchLoginMessages(ai)
    },

    async getExchangeSwapRate (
      fromCurrencyCode: string,
      toCurrencyCode: string
    ): Promise<number> {
      return shapeshiftApi.getExchangeSwapRate(fromCurrencyCode, toCurrencyCode)
    },

    async getAvailableExchangeTokens (): Promise<Array<string>> {
      return shapeshiftApi.getAvailableExchangeTokens()
    },

    async getExchangeSwapInfo (
      fromCurrencyCode: string,
      toCurrencyCode: string
    ): Promise<EdgeExchangeSwapInfo> {
      return shapeshiftApi.getExchangeSwapInfo(fromCurrencyCode, toCurrencyCode)
    },

    // Deprecated API's:
    pinExists (username: string): Promise<boolean> {
      return this.pinLoginEnabled(username)
    }
  }

  return wrapObject('Context', rawContext)
}
