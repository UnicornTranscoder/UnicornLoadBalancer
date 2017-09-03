/**
 * Created by Maxime Baconnais on 29/08/2017.
 */

const httpProxy = require('http-proxy');
const config = require('../config');

let proxy = new httpProxy.createProxyServer({
	target: {
		host: config.plex.host,
		port: config.plex.port
	}
});

proxy.on('upgrade', (req, socket, head) => {
	proxy.ws(req, socket, head);
});


module.exports = proxy;