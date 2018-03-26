/**
 * Created by Maxime Baconnais on 29/08/2017.
 */

const express = require('express');
const request = require('request');
const router = express.Router();

const config = require('../config');
const proxy = require('../core/proxy');
const redirect = require('../core/redirect');
const serverManager = require('../core/serverManager');
const stats = require('../core/stats');
const getIp = require('../utils/getIp');
const reloadConf = require('../utils/reloadConf');

//Reload Config
router.get('/api/reload', reloadConf.reloadConf);


router.get('/api/scores', (req, res) => {
	let output = {};
	for (let i = 0; i < config.cluster.length; i++) {
		output[config.cluster[i]] = serverManager.calculateServerLoad(stats[config.cluster[i]]);
	}
	res.send(JSON.stringify(output));
});

router.get('/api/stats', (req, res) => {
	let output = {};
	for (let i = 0; i < config.cluster.length; i++) {
		output[config.cluster[i]] = stats[config.cluster[i]];
	}
	
	res.send(JSON.stringify(output));
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
});

router.get('/video/:/transcode/universal/ping', (req, res) => {
	proxy.web(req, res);
	
	const sessionId = serverManager.getSession(req);
	const serverUrl = serverManager.chooseServer(sessionId, getIp(req));

	request(serverUrl + '/video/:/transcode/universal/ping?session=' + sessionId);
});

router.get('/:/timeline', (req, res) => {
	proxy.web(req, res);
	
	const sessionId = serverManager.getSession(req);
	const serverUrl = serverManager.chooseServer(sessionId, getIp(req));
	
	if (req.query.state == 'stopped')
		request(serverUrl + '/video/:/transcode/universal/stop?session=' + sessionId);
	else
		request(serverUrl + '/video/:/transcode/universal/ping?session=' + sessionId);
});

// Download files
router.get('/library/parts/:id1/:id2/file.*', redirect);

// Direct plex call
router.all('/api/direct/*', (req, res) => {
	req.url = req.url.slice('/api/direct'.length);
    return (proxy.web(req, res));
});

// Reverse all others to plex
router.all('*', (req, res) => {
	proxy.web(req, res);
});

module.exports = router;
