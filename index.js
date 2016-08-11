var fs = require("fs")
  , url = require("url")
  , join = require("path").join
  , EventEmitter = require("events").EventEmitter
  , AuthPort = module.exports = new EventEmitter

AuthPort.servers = {}
AuthPort.customServices = {}
AuthPort.route = /^\/auth\/([^\/]+)\/?$/

AuthPort.createServer = function(options, listener) {
  var service = options.service
    , name = options.name || service
    , path = join(__dirname, "lib/services", service)
    , Service
    , server

  if (!(Service = AuthPort.customServices[name])) {
    try { Service = require(path) }
    catch (err) { throw "No such service: " + path }
  }

  server = AuthPort.servers[name] = new Service(options)

  server.on("auth", function(req, res, user) {
    user.service = name
    AuthPort.emit("auth", req, res, user)
  })

  server.on("error", function(req, res, error) {
    error.service = name
    AuthPort.emit("error", req, res, error)
  })

  if (listener) server.on("request", listener)

  return server
}

AuthPort.registerService = function(serviceName, Service) {
  AuthPort.customServices[serviceName] = Service
}

AuthPort.listener = function(req, res) {
  var path = url.parse(req.url).pathname
    , match = path.match(AuthPort.route)
    , service = match && AuthPort.servers[match[1]]

  if (service) {
    service.emit("request", req, res)
    return true
  }
}

AuthPort.listen = function(server) {
  var listeners = server.listeners("request")

  server.removeAllListeners("request")

  server.on("request", function(req, res) {
    if (AuthPort.listener(req, res)) return

    listeners.forEach(function(listener) {
      listener.call(server, req, res)
    })
  })
}

AuthPort.app = function(req, res) {
  var name = req.params.service
    , server = AuthPort.servers[name]

  server.emit("request", req, res)
}