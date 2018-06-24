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
			.replace("streamingBrainABRVersion=", "DISABLEDstreamingBrainABRVersion=") // Disable Streaming adaptative
			.replace('allowSync="1"', 'allowSync="0"') // Disable Sync option
			.replace('sync="1"', 'DISABLEDsync="1"') // Disable Sync option
			.replace('updater="1"', 'updater="0"') // Disable updates
			.replace('backgroundProcessing="1"', 'DISABLEDbackgroundProcessing="1"') // Disable Optimizing feature
			.replace('livetv="', 'DISABLEDlivetv="') // Disable LiveTV
			.replace('allowTuners="', 'DISABLEDallowTuners="') // Disable Tuners
			.replace('ownerFeatures="', 'ownerFeatures="session_kick,') // Enable Session Kick Feature
			);
	});
});

proxy.on('error', (err, req, res) => {
	console.log('error', err);
	res.writeHead(404, {});
	res.end('Plex not respond in time, proxy request fails');
});

module.exports = proxy;