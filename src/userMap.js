var crypto = require('./crypto.js')

/**
 * Returns the user map, which goes from usernames to userId's
 */
function load (localStorage) {
  try {
    var userMap = JSON.parse(localStorage.getItem('airbitz.users'))
    return userMap || {}
  } catch (e) {
    return {}
  }
}
exports.load = load

/**
 * Ensures that the userMap contains the given user. Adds the user if not.
 */
function insert (localStorage, username, userId) {
  var userMap = load(localStorage)
  userMap[username] = userId
  localStorage.setItem('airbitz.users', JSON.stringify(userMap))
}
exports.insert = insert

/**
 * Computes the userId (L1) for the given username.
 */
function getUserId (localStorage, username) {
  var userMap = load(localStorage)
  return userMap[username] ||
    crypto.scrypt(username, crypto.userIdSnrp).toString('base64')
}
exports.getUserId = getUserId

/**
 * Normalizes a username, and checks for invalid characters.
 */
function normalize (username) {
  var out = username + ''
  out = out.toLowerCase()
    .replace(/[ \f\r\n\t\v]+/g, ' ')
    .replace(/ $/, '')
    .replace(/^ /, '')

  for (var i = 0; i < out.length; ++i) {
    var c = out.charCodeAt(i)
    if (c < 0x20 || c > 0x7e) {
      throw Error('Bad characters in username')
    }
  }
  return out
}
exports.normalize = normalize