/**
 * Created by Maxime Baconnais on 29/08/2017.
 */

const Netmask = require('netmask').Netmask;
const config = require('../config');
const stats = require('../core/stats');

let serverManager = {}

serverManager.cacheSession = {};
serverManager.sessions = {};
serverManager.stoppedSessions = {};

serverManager.saveSession = (req) => {
    if (typeof(req.query['X-Plex-Session-Identifier']) !== 'undefined' && typeof(req.query.session) !== 'undefined') {
        serverManager.cacheSession[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
    }
};

serverManager.calculateServerLoad = (stats) => {
	// The configuration is unavailable, the server is probably unavailable
	if (!stats)
		return (1000);
	
	// Default load 0
	let load = 0;
	
	// Each transcode add 1 to the load
	load += stats.transcoding;
	
	// Each HEVC sessions add 1.5 to the load
	if (stats.codecs.hevc)
		load += stats.codecs.hevc * 1.5;
	
	// Server already have too much sessions
	if (stats.config && stats.sessions >= stats.config.preferredMaxSessions)
		load += 2.5;
	
	// Server already have too much transcodes
	if (stats.config && stats.transcoding >= stats.config.preferredMaxTranscodes)
		load += 5;
	
	// Server already have too much downloads
	if (stats.config && stats.downloads >= stats.config.preferredMaxDownloads)
		load += 1;
	
	// Return load
	return (load);
}

serverManager.getSession = (req) => {
	if (typeof(req.params.sessionId) !== 'undefined')
		return (req.params.sessionId);
	if (typeof(req.query.session) !== 'undefined')
		return (req.query.session);
	if (typeof(req.query['X-Plex-Session-Identifier']) !== 'undefined' && typeof(serverManager.cacheSession[req.query['X-Plex-Session-Identifier']]) !== 'undefined')
		return (serverManager.cacheSession[req.query['X-Plex-Session-Identifier']]);
	if (typeof(req.query['X-Plex-Session-Identifier']) !== 'undefined')
		return (req.query['X-Plex-Session-Identifier']);
	if (typeof(req.query['X-Plex-Client-Identifier']) !== 'undefined')
		return (req.query['X-Plex-Client-Identifier']);
	return (false);
};

serverManager.removeServer = (url) => {
	for (let session in serverManager.sessions) {
		if (serverManager.sessions[session] == url)
			delete serverManager.sessions[session];
	}
};

serverManager.forceStopStream = (session, reason) => {
	serverManager.stoppedSessions[session] = reason;
};

serverManager.chooseServer = (session, ip = false) => {
	
	//Pre-prod
	if (config.preprod.enabled && ip) {
        for (let i = 0; i < config.preprod.devIps.length; i++) {
            let mask = new Netmask(config.preprod.devIps[i]);

            if (mask.contains(ip))
                return config.preprod.server;
        }
	}
	
	let count = config.cluster.length;
	if (count == 0)
		return (false);
	if (typeof(serverManager.sessions[session]) !== 'undefined' &&
		config.cluster.indexOf(serverManager.sessions[session]) != -1 &&
		stats[serverManager.sessions[session]]) {
		return (serverManager.sessions[session]);
	}
	
	let sortedServers = config.cluster.sort((url) => { return (serverManager.calculateServerLoad(stats[url]));});
		
	serverManager.sessions[session] = sortedServers[0];
	
	return (sortedServers[0]);
};

serverManager.removeSession = (session) => {
	delete serverManager.sessions[session];
	delete serverManager.stoppedSessions[session];
};

module.exports = serverManager;