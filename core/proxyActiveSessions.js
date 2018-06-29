/**
 * Created by Maxime Baconnais on 23/06/2018.
 */

const httpProxy = require('http-proxy');
const config = require('../config');
const serverManager = require('./serverManager');
const stats = require('./stats');

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
		
		let videos = body.split('<Video');
		for (let i = 1 ; i < videos.length ; i++)
		{
			// Extract Session ID
			let session = '';
			if (videos[i].split('<Session id="').length < 2)
				session = videos[i].split('<Session id="')[1].split('"')[0];

			// Get server
			let server = "Unknown";
			if (typeof(serverManager.sessions[session]) != 'undefined')
				server = serverManager.sessions[session];
			else if (typeof(serverManager.cacheSession[session]) != 'undefined' && typeof(serverManager.sessions[serverManager.cacheSession[session]]) != 'undefined')
				server = serverManager.sessions[serverManager.cacheSession[session]];
			
			// Get proper name
			if (stats[server] && stats[server].config && stats[server].config.serverName && stats[server].config.serverName.length > 0)
				server = stats[server].config.serverName;
			else
				server = server.replace('https://www.', '').replace('http://www.', '').replace('https://', '').replace('http://', '');
			
			// Get player
			let player = videos[i].split('<Player')[1].split('title="')[1].split('"')[0];
			
			// Patch player name
			videos[i] = videos[i].replace(' title="' + player + '"', ' title="' + player + ' (' + server + ')"');
		}
		body = videos.join('<Video');
		
		res.header("Content-Type", "text/xml;charset=utf-8");
		res.send(body);
	});
});

proxy.on('error', (err, req, res) => {
	console.log('error', err);
	res.writeHead(404, {});
	res.end('Plex not respond in time, proxy request fails');
});

module.exports = proxy;