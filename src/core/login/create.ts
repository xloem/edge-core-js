import { uncleaner } from 'cleaners'
import { base64 } from 'rfc4648'

import {
  asChangeSecretPayload,
  asCreateLoginPayload
} from '../../types/server-cleaners'
import {
  asMaybeUsernameError,
  EdgeAccountOptions,
  EdgeWalletInfo
} from '../../types/types'
import { encrypt } from '../../util/crypto/crypto'
import { ApiInput } from '../root-pixie'
import { makeKeysKit } from './keys'
import { loginFetch } from './login-fetch'
import { fixUsername, hashUsername } from './login-selectors'
import { LoginStash, saveStash } from './login-stash'
import { LoginKit, LoginTree } from './login-types'
import { makePasswordKit } from './password'
import { makeChangePin2Kit } from './pin2'

const wasChangeSecretPayload = uncleaner(asChangeSecretPayload)
const wasCreateLoginPayload = uncleaner(asCreateLoginPayload)

export interface LoginCreateOpts {
  keyInfo?: EdgeWalletInfo
  password?: string | undefined
  pin?: string | undefined
}

/**
 * Determines whether or not a username is available.
 */
export function usernameAvailable(
  ai: ApiInput,
  username: string
): Promise<boolean> {
  return hashUsername(ai, username).then(userId => {
    const request = {
      userId: base64.stringify(userId)
    }
    return loginFetch(ai, 'POST', '/v2/login', request)
      .then(reply => false) // It's not available if we can hit it!
      .catch((error: unknown) => {
        if (asMaybeUsernameError(error) != null) return true
        throw error
      })
  })
}

/**
 * Assembles all the data needed to create a new login.
 */
export function makeCreateKit(
  ai: ApiInput,
  parentLogin: LoginTree | undefined,
  appId: string,
  username: string,
  opts: LoginCreateOpts
): Promise<LoginKit> {
  const { io } = ai.props

  // Figure out login identity:
  const loginId =
    parentLogin != null ? io.random(32) : hashUsername(ai, username)
  const loginKey = io.random(32)

  const dummyLogin: LoginTree = {
    appId,
    lastLogin: new Date(),
    loginId: '',
    loginKey,
    pendingVouchers: [],
    children: [],
    keyInfos: []
  }

  // Set up login methods:
  const dummyKit: LoginKit = {} as any
  const parentBox =
    parentLogin != null
      ? encrypt(io, loginKey, parentLogin.loginKey)
      : undefined
  const passwordKit: Promise<LoginKit> =
    opts.password != null
      ? makePasswordKit(ai, dummyLogin, username, opts.password)
      : Promise.resolve(dummyKit)
  const pin2Kit: LoginKit =
    opts.pin != null
      ? makeChangePin2Kit(ai, dummyLogin, username, opts.pin, true)
      : dummyKit
  const keysKit =
    opts.keyInfo != null ? makeKeysKit(ai, dummyLogin, opts.keyInfo) : dummyKit

  // Secret-key login:
  const loginAuth = io.random(32)
  const loginAuthBox = encrypt(io, loginAuth, loginKey)
  const secretServer = wasChangeSecretPayload({
    loginAuth,
    loginAuthBox
  })

  // Bundle everything:
  return Promise.all([loginId, passwordKit]).then(values => {
    const [loginIdRaw, passwordKit] = values
    const loginId = base64.stringify(loginIdRaw)

    return {
      loginId,
      serverPath: '/v2/login/create',
      server: {
        ...(wasCreateLoginPayload({
          appId,
          loginId,
          parentBox
        }) as {}),
        ...(keysKit.server as {}),
        ...(passwordKit.server as {}),
        ...(pin2Kit.server as {}),
        ...(secretServer as {})
      },
      stash: {
        appId,
        loginAuthBox,
        loginId,
        parentBox,
        ...passwordKit.stash,
        ...pin2Kit.stash,
        ...keysKit.stash
      },
      login: {
        appId,
        loginAuth,
        loginId,
        loginKey,
        keyInfos: [],
        ...passwordKit.login,
        ...pin2Kit.login,
        ...keysKit.login
      }
    }
  })
}

/**
 * Creates a new login on the auth server.
 */
export async function createLogin(
  ai: ApiInput,
  username: string,
  accountOpts: EdgeAccountOptions,
  opts: LoginCreateOpts
): Promise<LoginTree> {
  const fixedName = fixUsername(username)
  const { now = new Date() } = accountOpts

  const kit = await makeCreateKit(ai, undefined, '', fixedName, opts)
  kit.login.username = fixedName
  kit.stash.username = fixedName
  kit.login.userId = kit.login.loginId

  const request = { data: kit.server }
  await loginFetch(ai, 'POST', kit.serverPath, request)

  kit.stash.lastLogin = now
  await saveStash(ai, kit.stash as LoginStash)
  return kit.login as LoginTree
}
