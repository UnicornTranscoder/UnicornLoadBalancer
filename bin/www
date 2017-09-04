#!/usr/bin/env node

let app = require('../app')
let config = require('../config')
let debug = require('debug')('UnicornLoadBalancer:server')
let http = require('http')
const proxy = require('../core/proxy');

app.set(config.port)
let server = http.createServer(app)

server.listen(config.loadBalancer.port)
server.on('error', onError)
server.on('listening', onListening)
server.on('upgrade', function (req, res) {
	proxy.ws(req, res);
});

function onError(error) {
    if (error.syscall !== 'listen') {
        throw error
    }

    var bind = typeof config.loadBalancer.port === 'string'
        ? 'Pipe ' + config.loadBalancer.port
        : 'Port ' + config.loadBalancer.port

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges')
            process.exit(1)
            break
        case 'EADDRINUSE':
            console.error(bind + ' is already in use')
            process.exit(1)
            break
        default:
            throw error
    }
}

function onListening() {
    var addr = server.address()
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port
    debug('Listening on ' + bind)
}
