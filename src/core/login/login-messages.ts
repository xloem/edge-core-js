import { asMessagesPayload } from '../../types/server-cleaners'
import { EdgeLoginMessages } from '../../types/types'
import { ApiInput } from '../root-pixie'
import { loginFetch } from './login-fetch'

/**
 * Fetches any login-related messages for all the users on this device.
 */
export function fetchLoginMessages(ai: ApiInput): Promise<EdgeLoginMessages> {
  const stashes = ai.props.state.login.stashes

  const loginMap: { [loginId: string]: string } = {} // loginId -> username
  for (const username of Object.keys(stashes)) {
    const loginId = stashes[username].loginId
    if (loginId != null) loginMap[loginId] = username
  }

  const request = {
    loginIds: Object.keys(loginMap)
  }
  return loginFetch(ai, 'POST', '/v2/messages', request).then(reply => {
    const out: EdgeLoginMessages = {}
    for (const message of asMessagesPayload(reply)) {
      const username = loginMap[message.loginId]
      if (username != null) out[username] = message
    }
    return out
  })
}
