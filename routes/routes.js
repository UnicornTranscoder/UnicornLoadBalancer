/**
 * Created by Maxime Baconnais on 29/08/2017.
 */

const express = require('express');
const request = require('request');
const httpProxy = require('http-proxy');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();

const config = require('../config');
const proxy = require('../core/proxy');
const proxyConfig = require('../core/proxyConfig');
const proxyActiveSessions = require('../core/proxyActiveSessions');
const redirect = require('../core/redirect');
const serverManager = require('../core/serverManager');
const stats = require('../core/stats');
const getIp = require('../utils/getIp');
const reloadConf = require('../utils/reloadConf');

//Reload Config
router.get('/api/reload', reloadConf.reloadConf);

// Return the scores of transcoders
router.get('/api/scores', (req, res) => {
	let output = {};
	for (let i = 0; i < config.cluster.length; i++) {
		output[config.cluster[i]] = serverManager.calculateServerLoad(stats[config.cluster[i]]);
	}
	res.send(JSON.stringify(output));
});

// Return the stats of transcoders
router.get('/api/stats', (req, res) => {
	let output = {};
	for (let i = 0; i < config.cluster.length; i++) {
		output[config.cluster[i]] = stats[config.cluster[i]];
	}
	res.send(JSON.stringify(output));
});

// Reverse plex download ID to path
router.get('/api/pathname/:downloadid', (req, res) => {
	try {
		let db = new sqlite3.Database(config.plex.database);
		db.get("SELECT * FROM media_parts WHERE id=? LIMIT 0,1", req.params.downloadid, (err, row) => {
			if (row && row.file)
				res.send(JSON.stringify(row));
			else
				res.status(404).send('File not found in Plex Database');
			db.close();
		});
	}
	catch (err) {
		res.status(404).send('File not found in Plex Database');
	}
});

// Direct plex call
router.all('/api/plex/*', (req, res) => {
	req.url = req.url.slice('/api/plex'.length);
    return (proxy.web(req, res));
});

//Dash routes
router.get('/video/:/transcode/universal/start.mpd', (req, res) => {
	
	let sessionId = false;
	if (typeof(req.query['X-Plex-Session-Identifier']) !== 'undefined' && typeof(serverManager.cacheSession[req.query['X-Plex-Session-Identifier']]) !== 'undefined')
		sessionId = serverManager.cacheSession[req.query['X-Plex-Session-Identifier']];
	
	if (sessionId !== false) {
		const serverUrl = serverManager.chooseServer(sessionId, getIp(req));
		request(serverUrl + '/video/:/transcode/universal/stop?session=' + sessionId, (err, httpResponse, body) => {
			serverManager.saveSession(req);
			redirect(req, res);
		});
	} else {
		serverManager.saveSession(req);
		redirect(req, res);
	}
});
router.get('/video/:/transcode/universal/dash/:sessionId/:streamId/initial.mp4', redirect);
router.get('/video/:/transcode/universal/dash/:sessionId/:streamId/:partId.m4s', redirect);

//Stream mode
router.get('/video/:/transcode/universal/start', (req, res) => {
	serverManager.saveSession(req);
    redirect(req, res);
});
router.get('/video/:/transcode/universal/subtitles', redirect);

//m3u8 mode
router.get('/video/:/transcode/universal/start.m3u8', (req, res) => {
	serverManager.saveSession(req);
    redirect(req, res);
});
router.get('/video/:/transcode/universal/session/:sessionId/base/index.m3u8', redirect);
router.get('/video/:/transcode/universal/session/:sessionId/base-x-mc/index.m3u8', redirect);
router.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.ts', redirect);
router.get('/video/:/transcode/universal/session/:sessionId/:fileType/:partId.vtt', redirect);

//Universal endpoints
router.get('/video/:/transcode/universal/stop', (req, res) => {
	proxy.web(req, res);
	
	const sessionId = serverManager.getSession(req);
	const serverUrl = serverManager.chooseServer(sessionId, getIp(req));

	request(serverUrl + '/video/:/transcode/universal/stop?session=' + sessionId);
	
	setTimeout(() => {
		serverManager.removeSession(sessionId);
		if (typeof(serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']]) != 'undefined')
			delete serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']];
	}, 1000);
});

router.get('/video/:/transcode/universal/ping', (req, res) => {
	proxy.web(req, res);
	
	const sessionId = serverManager.getSession(req);
	const serverUrl = serverManager.chooseServer(sessionId, getIp(req));

	request(serverUrl + '/video/:/transcode/universal/ping?session=' + sessionId);
});

router.get('/:/timeline', (req, res) => {
	
	const sessionId = serverManager.getSession(req);
	const serverUrl = serverManager.chooseServer(sessionId, getIp(req));
	
	let cproxy = false;
	if (typeof(req.query['X-Plex-Session-Identifier']) !== 'undefined' && typeof(serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']]) != 'undefined')
	{
		cproxy = httpProxy.createProxyServer({
			target: {
				host: config.plex.host,
				port: config.plex.port
			},
			selfHandleResponse: true
		});
		cproxy.on('proxyRes', (proxyRes, req, res) => {
			let body = new Buffer('');
			proxyRes.on('data', (data) => {
				body = Buffer.concat([body, data]);
			});
			proxyRes.on('end', () => {
				body = body.toString();
				res.header("Content-Type", "text/xml;charset=utf-8");
				res.send(body.replace("<MediaContainer ", '<MediaContainer terminationCode="2006" terminationText="' + serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']].replace('"', '&#34;') + '" '));
			});
		})
		cproxy.on('error', (err, req, res) => {
			console.log('error', err);
			res.writeHead(404, {});
			res.end('Plex not respond in time, proxy request fails');
		});
	}
	else
		cproxy = proxy;
	
	if (req.query.state == 'stopped' || (typeof(req.query['X-Plex-Session-Identifier']) !== 'undefined' && typeof(serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']]) != 'undefined'))
	{
		cproxy.web(req, res);
		
		request(serverUrl + '/video/:/transcode/universal/stop?session=' + sessionId);			
		setTimeout(() => {
			serverManager.removeSession(sessionId);
			if (typeof(serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']]) != 'undefined')
				delete serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']];
		}, 1000);
	}
	else
	{
		proxy.web(req, res);
		request(serverUrl + '/video/:/transcode/universal/ping?session=' + sessionId);
	}
});

router.get('/status/sessions/terminate', (req, res) => {
	res.header("Content-Type", "text/xml;charset=utf-8");
	res.send(`<?xml version="1.0" encoding="UTF-8"?>
<MediaContainer size="0">
</MediaContainer>`);
	if (typeof(req.query.sessionId) !== 'undefined' && typeof(req.query.reason) !== 'undefined')
	{
		const sessionId = req.query.sessionId;
		serverManager.forceStopStream(sessionId, req.query.reason);
	}
});

// Download files
router.get('/library/parts/:id1/:id2/file.*', redirect);

// Plex activity page
/*router.get('/status/sessions', (req, res) => {
	proxyActiveSessions.web(req, res);
});*/

// Plex configuration get
/*router.get('/', (req, res) => {
	if (req.query['X-Plex-Device-Name'])
		proxyConfig.web(req, res);
	else
		proxy.web(req, res);
});*/

// Reverse all others to plex
router.all('*', (req, res) => {
	proxy.web(req, res);
});

module.exports = router;
