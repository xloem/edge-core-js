import {
  EdgeContext,
  EdgeContextOptions,
  EdgeCorePlugins,
  EdgeCorePluginsInit,
  EdgeFakeUser,
  EdgeFakeWorld,
  EdgeFakeWorldOptions,
  EdgeIo,
  EdgeLoginMessages,
  EdgeLogSettings,
  EdgeNativeIo,
  EdgeOnLog
} from './types'

const hack: any = null

export const addEdgeCorePlugins = (plugins: EdgeCorePlugins): void => hack
export const lockEdgeCorePlugins = (): void => hack
export const closeEdge = (): void => hack
export const makeFakeIo = (): EdgeIo => hack

/**
 * Initializes the Edge core library,
 * automatically selecting the appropriate platform.
 */
export const makeEdgeContext = (
  opts: EdgeContextOptions
): Promise<EdgeContext> => hack

export const makeFakeEdgeWorld = (
  users?: EdgeFakeUser[],
  opts?: EdgeFakeWorldOptions
): Promise<EdgeFakeWorld> => hack

/**
 * React Native component for creating an EdgeContext.
 */
export const MakeEdgeContext = (props: {
  debug?: boolean
  nativeIo?: EdgeNativeIo
  onError?: (e: any) => unknown
  onLoad: (context: EdgeContext) => unknown

  // Deprecated. Just pass options like `apiKey` as normal props:
  options?: EdgeContextOptions

  // EdgeContextOptions:
  apiKey?: string
  appId?: string
  authServer?: string
  deviceDescription?: string
  hideKeys?: boolean
  logSettings?: Partial<EdgeLogSettings>
  onLog?: EdgeOnLog
  plugins?: EdgeCorePluginsInit
}): any => hack // React element

/**
 * React Native component for creating an EdgeFakeWorld for testing.
 */
export const MakeFakeEdgeWorld = (props: {
  debug?: boolean
  nativeIo?: EdgeNativeIo
  onError?: (e: any) => unknown
  onLoad: (context: EdgeFakeWorld) => unknown
  onLog?: EdgeOnLog
  users: EdgeFakeUser[]
}): any => hack // React element

/**
 * React Native function for getting login alerts without a context:
 */
export const fetchLoginMessages = (apiKey: string): EdgeLoginMessages => hack

// System-specific io exports:
export const makeBrowserIo = (): EdgeIo => hack
export const makeNodeIo = (path: string): EdgeIo => hack
