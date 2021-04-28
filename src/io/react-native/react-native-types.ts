import { Disklet } from 'disklet'

import { LogBackend } from '../../core/log/log'
import {
  EdgeContext,
  EdgeContextOptions,
  EdgeFakeUser,
  EdgeFakeWorld,
  EdgeFetchOptions,
  EdgeNativeIo,
  EdgeScryptFunction
} from '../../types/types'
import { HttpResponse } from '../../util/http/http-types'

export interface ClientIo {
  readonly disklet: Disklet

  readonly entropy: string // base64
  readonly scrypt: EdgeScryptFunction

  // Networking:
  fetchCors: (url: string, opts: EdgeFetchOptions) => Promise<HttpResponse>
}

export interface WorkerApi {
  makeEdgeContext: (
    clientIo: ClientIo,
    nativeIo: EdgeNativeIo,
    logBackend: LogBackend,
    opts: EdgeContextOptions
  ) => Promise<EdgeContext>

  makeFakeEdgeWorld: (
    clientIo: ClientIo,
    nativeIo: EdgeNativeIo,
    logBackend: LogBackend,
    users?: EdgeFakeUser[]
  ) => Promise<EdgeFakeWorld>
}
