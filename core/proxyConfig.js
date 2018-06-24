/**
 * Created by Maxime Baconnais on 23/06/2018.
 */

const httpProxy = require('http-proxy');
const config = require('../config');

let proxy = httpProxy.createProxyServer({
	target: {
		host: config.plex.host,
		port: config.plex.port
	},
    selfHandleResponse: true
});

proxy.on('proxyRes', (proxyRes, req, res) => {
	let body = new Buffer('');
	proxyRes.on('data', (data) => {
		body = Buffer.concat([body, data]);
	});
	proxyRes.on('end', () => {
		body = body.toString();
		res.header("Content-Type", "text/xml;charset=utf-8");
		res.send(body
			.replace("streamingBrainABRVersion=", "DISABLEDstreamingBrainABRVersion=")
			.replace('ownerFeatures="', 'ownerFeatures="session_bandwidth_restrictions,session_kick,trailers,pass,'));
	});
});

proxy.on('error', (err, req, res) => {
	console.log('error', err);
	res.writeHead(404, {});
	res.end('Plex not respond in time, proxy request fails');
});

module.exports = proxy;