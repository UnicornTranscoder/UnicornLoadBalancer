/**
 * Created by Maxime Baconnais on 23/06/2018.
 */

const httpProxy = require('http-proxy');
const config = require('../config');

let proxy = httpProxy.createProxyServer({
	target: {
		host: config.plex.host,
		port: config.plex.port
	}
});

proxy.on('proxyRes', (proxyRes, req, res) => {
	let body = new Buffer('');
	proxyRes.on('data', (data) => {
		body = Buffer.concat([body, data]);
	});
	proxyRes.on('end', () => {
		body = body.toString();
		res.send(body.replace("streamingBrainABRVersion=", "DISABLEDstreamingBrainABRVersion="));
	});
});

proxy.on('error', (err, req, res) => {
  res.writeHead(500, {});
  res.end('Plex not respond in time, proxy request fails');
});

module.exports = proxy;