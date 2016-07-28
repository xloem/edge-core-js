var crypto = require('./crypto.js')
var UserStorage = require('./userStorage.js').UserStorage
var userMap = require('./userMap.js')
var loginPassword = require('./login/password.js')
var loginPin = require('./login/pin.js')

function Account (ctx, username, dataKey) {
  this.ctx = ctx
  this.username = username
  this.userStorage = new UserStorage(ctx.localStorage, username)
  this.userId = userMap.getUserId(ctx.localStorage, username)

  // Grab all the boxes:
  var passwordAuthBox = this.userStorage.getJson('passwordAuthBox')
  var rootKeyBox = this.userStorage.getJson('rootKeyBox')
  var syncKeyBox = this.userStorage.getJson('syncKeyBox')
  if (!passwordAuthBox) throw Error('Missing passwordAuthBox')
  if (!rootKeyBox) throw Error('Missing rootKeyBox')
  if (!syncKeyBox) throw Error('Missing syncKeyBox')

  // Set up the keys:
  this.dataKey = dataKey
  this.passwordAuth = crypto.decrypt(passwordAuthBox, dataKey)
  this.syncKey = crypto.decrypt(syncKeyBox, dataKey)
  this.rootKey = crypto.decrypt(rootKeyBox, dataKey)
}

Account.prototype.logout = function () {
  this.dataKey = null
  this.passwordAuth = null
  this.syncKey = null
  this.rootKey = null
}

Account.prototype.passwordOk = function (password) {
  return loginPassword.check(this.ctx, this, password)
}

Account.prototype.passwordSetup = function (password, callback) {
  return loginPassword.setup(this.ctx, this, password, callback)
}

Account.prototype.pinSetup = function (pin, callback) {
  return loginPin.setup(this.ctx, this, pin, callback)
}

exports.Account = Account
exports.UserStorage = 'fun'