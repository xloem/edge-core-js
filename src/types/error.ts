import { Cleaner } from 'cleaners'
import { base64 } from 'rfc4648'

import { asOtpErrorPayload, asPasswordErrorPayload } from './server-cleaners'
import { EdgeSwapInfo } from './types'

/*
 * These are errors the core knows about.
 *
 * The GUI should handle these errors in an "intelligent" way, such as by
 * displaying a localized error message or asking the user for more info.
 * All these errors have a `name` field, which the GUI can use to select
 * the appropriate response.
 *
 * Other errors are possible, of course, since the Javascript language
 * itself can generate exceptions. Those errors won't have a `type` field,
 * and the GUI should just show them with a stack trace & generic message,
 * since the program has basically crashed at that point.
 */

export const errorNames = {
  DustSpendError: 'DustSpendError',
  InsufficientFundsError: 'InsufficientFundsError',
  NetworkError: 'NetworkError',
  NoAmountSpecifiedError: 'NoAmountSpecifiedError',
  ObsoleteApiError: 'ObsoleteApiError',
  OtpError: 'OtpError',
  PasswordError: 'PasswordError',
  PendingFundsError: 'PendingFundsError',
  SameCurrencyError: 'SameCurrencyError',
  SpendToSelfError: 'SpendToSelfError',
  SwapAboveLimitError: 'SwapAboveLimitError',
  SwapBelowLimitError: 'SwapBelowLimitError',
  SwapCurrencyError: 'SwapCurrencyError',
  SwapPermissionError: 'SwapPermissionError',
  UsernameError: 'UsernameError'
}

/**
 * Trying to spend an uneconomically small amount of money.
 */
export class DustSpendError extends Error {
  name: string

  constructor(message: string = 'Please send a larger amount') {
    super(message)
    this.name = 'DustSpendError'
  }
}

/**
 * Trying to spend more money than the wallet contains.
 */
export class InsufficientFundsError extends Error {
  name: string
  readonly currencyCode: string | undefined

  constructor(currencyCode?: string) {
    let message
    if (currencyCode == null) {
      message = 'Insufficient funds'
    } else if (currencyCode.length > 5) {
      // Some plugins pass a message instead of a currency code:
      message = currencyCode
      currencyCode = undefined
    } else {
      message = `Insufficient ${currencyCode}`
    }

    super(message)
    this.name = 'InsufficientFundsError'
    if (currencyCode != null) this.currencyCode = currencyCode
  }
}

/**
 * Could not reach the server at all.
 */
export class NetworkError extends Error {
  name: string
  readonly type: string // deprecated

  constructor(message: string = 'Cannot reach the network') {
    super(message)
    this.name = this.type = 'NetworkError'
  }
}

/**
 * Attempting to create a MakeSpend without specifying an amount of currency to send
 */
export class NoAmountSpecifiedError extends Error {
  name: string

  constructor(message: string = 'Unable to create zero-amount transaction.') {
    super(message)
    this.name = 'NoAmountSpecifiedError'
  }
}

/**
 * The endpoint on the server is obsolete, and the app needs to be upgraded.
 */
export class ObsoleteApiError extends Error {
  name: string
  readonly type: string // deprecated

  constructor(message: string = 'The application is too old. Please upgrade.') {
    super(message)
    this.name = this.type = 'ObsoleteApiError'
  }
}

/**
 * The OTP token was missing / incorrect.
 *
 * The error object should include a `resetToken` member,
 * which can be used to reset OTP protection on the account.
 *
 * The error object may include a `resetDate` member,
 * which indicates that an OTP reset is already pending,
 * and when it will complete.
 */
export class OtpError extends Error {
  name: string
  readonly type: string // deprecated
  readonly loginId: string | undefined
  readonly reason: 'ip' | 'otp'
  readonly resetDate: Date | undefined
  readonly resetToken: string | undefined
  readonly voucherId: string | undefined
  readonly voucherAuth: string | undefined // base64, to avoid a breaking change
  readonly voucherActivates: Date | undefined

  constructor(resultsJson: unknown, message: string = 'Invalid OTP token') {
    super(message)
    this.name = this.type = 'OtpError'
    this.reason = 'otp'

    try {
      const clean = asOtpErrorPayload(resultsJson)

      // This should usually be present:
      if (clean.login_id != null) {
        this.loginId = clean.login_id
      }

      // Use this to request an OTP reset (if enabled):
      if (clean.otp_reset_auth != null) {
        this.resetToken = clean.otp_reset_auth
      }

      // We might also get a different reason:
      if (clean.reason === 'ip') this.reason = 'ip'

      // Set if an OTP reset has already been requested:
      if (clean.otp_timeout_date != null) {
        this.resetDate = new Date(clean.otp_timeout_date)
      }

      // We might also get a login voucher:
      if (clean.voucher_activates != null) {
        this.voucherActivates = clean.voucher_activates
      }
      if (clean.voucher_auth != null) {
        this.voucherAuth = base64.stringify(clean.voucher_auth)
      }
      if (clean.voucher_id != null) this.voucherId = clean.voucher_id
    } catch (e) {}
  }
}

/**
 * The provided authentication is incorrect.
 *
 * Reasons could include:
 * - Password login: wrong password
 * - PIN login: wrong PIN
 * - Recovery login: wrong answers
 *
 * The error object may include a `wait` member,
 * which is the number of seconds the user must wait before trying again.
 */
export class PasswordError extends Error {
  name: string
  readonly type: string // deprecated
  readonly wait: number | undefined // seconds

  constructor(resultsJson: unknown, message: string = 'Invalid password') {
    super(message)
    this.name = this.type = 'PasswordError'

    try {
      const clean = asPasswordErrorPayload(resultsJson)
      this.wait = clean.wait_seconds
    } catch (e) {}
  }
}

/**
 * Trying to spend funds that are not yet confirmed.
 */
export class PendingFundsError extends Error {
  name: string

  constructor(message: string = 'Not enough confirmed funds') {
    super(message)
    this.name = 'PendingFundsError'
  }
}

/**
 * Attempting to shape shift between two wallets of same currency.
 */
export class SameCurrencyError extends Error {
  name: string

  constructor(message: string = 'Wallets can not be the same currency') {
    super(message)
    this.name = 'SameCurrencyError'
  }
}

/**
 * Trying to spend to an address of the source wallet
 */
export class SpendToSelfError extends Error {
  name: string

  constructor(message: string = 'Spending to self') {
    super(message)
    this.name = 'SpendToSelfError'
  }
}

/**
 * Trying to swap an amount that is either too low or too high.
 * @param nativeMax the maximum supported amount, in the "from" currency.
 */
export class SwapAboveLimitError extends Error {
  name: string
  readonly pluginId: string
  readonly nativeMax: string

  constructor(swapInfo: EdgeSwapInfo, nativeMax: string) {
    super('Amount is too high')
    this.name = 'SwapAboveLimitError'
    this.pluginId = swapInfo.pluginId
    this.nativeMax = nativeMax
  }
}

/**
 * Trying to swap an amount that is either too low or too high.
 * @param nativeMin the minimum supported amount, in the "from" currency.
 */
export class SwapBelowLimitError extends Error {
  name: string
  readonly pluginId: string
  readonly nativeMin: string

  constructor(swapInfo: EdgeSwapInfo, nativeMin: string) {
    super('Amount is too low')
    this.name = 'SwapBelowLimitError'
    this.pluginId = swapInfo.pluginId
    this.nativeMin = nativeMin
  }
}

/**
 * The swap plugin does not support this currency pair.
 */
export class SwapCurrencyError extends Error {
  name: string
  readonly pluginId: string
  readonly fromCurrency: string
  readonly toCurrency: string

  constructor(
    swapInfo: EdgeSwapInfo,
    fromCurrency: string,
    toCurrency: string
  ) {
    super(
      `${swapInfo.displayName} does not support ${fromCurrency} to ${toCurrency}`
    )
    this.name = 'SwapCurrencyError'
    this.pluginId = swapInfo.pluginId
    this.fromCurrency = fromCurrency
    this.toCurrency = toCurrency
  }
}

type SwapPermissionReason =
  | 'geoRestriction'
  | 'noVerification'
  | 'needsActivation'

/**
 * The user is not allowed to swap these coins for some reason
 * (no KYC, restricted IP address, etc...).
 * @param reason A string giving the reason for the denial.
 * - 'geoRestriction': The IP address is in a restricted region
 * - 'noVerification': The user needs to provide KYC credentials
 * - 'needsActivation': The user needs to log into the service.
 */
export class SwapPermissionError extends Error {
  name: string
  readonly pluginId: string
  readonly reason: SwapPermissionReason | undefined

  constructor(swapInfo: EdgeSwapInfo, reason?: SwapPermissionReason) {
    if (reason != null) super(reason)
    else super('You are not allowed to make this trade')
    this.name = 'SwapPermissionError'
    this.pluginId = swapInfo.pluginId
    this.reason = reason
  }
}

/**
 * Cannot find a login with that id.
 *
 * Reasons could include:
 * - Password login: wrong username
 * - PIN login: wrong PIN key
 * - Recovery login: wrong username, or wrong recovery key
 */
export class UsernameError extends Error {
  name: string
  readonly type: string // deprecated

  constructor(message: string = 'Invalid username') {
    super(message)
    this.name = this.type = 'UsernameError'
  }
}

function asMaybeError<T>(name: string): Cleaner<T | undefined> {
  return function asError(raw) {
    if (raw instanceof Error && raw.name === name) {
      const typeHack: any = raw
      return typeHack
    }
  }
}

export const asMaybeDustSpendError: Cleaner<
  DustSpendError | undefined
> = asMaybeError('DustSpendError')
export const asMaybeInsufficientFundsError: Cleaner<
  InsufficientFundsError | undefined
> = asMaybeError('InsufficientFundsError')
export const asMaybeNetworkError: Cleaner<
  NetworkError | undefined
> = asMaybeError('NetworkError')
export const asMaybeNoAmountSpecifiedError: Cleaner<
  NoAmountSpecifiedError | undefined
> = asMaybeError('NoAmountSpecifiedError')
export const asMaybeObsoleteApiError: Cleaner<
  ObsoleteApiError | undefined
> = asMaybeError('ObsoleteApiError')
export const asMaybeOtpError: Cleaner<OtpError | undefined> = asMaybeError(
  'OtpError'
)
export const asMaybePasswordError: Cleaner<
  PasswordError | undefined
> = asMaybeError('PasswordError')
export const asMaybePendingFundsError: Cleaner<
  PendingFundsError | undefined
> = asMaybeError('PendingFundsError')
export const asMaybeSameCurrencyError: Cleaner<
  SameCurrencyError | undefined
> = asMaybeError('SameCurrencyError')
export const asMaybeSpendToSelfError: Cleaner<
  SpendToSelfError | undefined
> = asMaybeError('SpendToSelfError')
export const asMaybeSwapAboveLimitError: Cleaner<
  SwapAboveLimitError | undefined
> = asMaybeError('SwapAboveLimitError')
export const asMaybeSwapBelowLimitError: Cleaner<
  SwapBelowLimitError | undefined
> = asMaybeError('SwapBelowLimitError')
export const asMaybeSwapCurrencyError: Cleaner<
  SwapCurrencyError | undefined
> = asMaybeError('SwapCurrencyError')
export const asMaybeSwapPermissionError: Cleaner<
  SwapPermissionError | undefined
> = asMaybeError('SwapPermissionError')
export const asMaybeUsernameError: Cleaner<
  UsernameError | undefined
> = asMaybeError('UsernameError')