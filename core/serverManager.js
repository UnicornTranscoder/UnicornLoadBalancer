/**
 * Created by Maxime Baconnais on 29/08/2017.
 */

const Netmask = require('netmask').Netmask;
const config = require('../config');

let serverManager = {}

serverManager.cacheSession = {};
serverManager.sessions = {};

serverManager.saveSession = (req) => {
    if (typeof(req.query['X-Plex-Session-Identifier']) !== 'undefined' && typeof(req.query.session) !== 'undefined') {
        serverManager.cacheSession[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
    }
};

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

serverManager.chooseServer = (session, ip) => {
	let count = config.cluster.length;
	if (count == 0)
		return (false);
	if (typeof(serverManager.sessions[session]) !== 'undefined') {
		return (serverManager.sessions[session]);
	}

	//Pre-prod
	if (config.preprod.enabled) {
        for (let i = 0; i < config.preprod.devIps.length; i++) {
            let mask = new Netmask(config.preprod.devIps[i]);

            if (mask.contains(ip))
                return config.preprod.server;
        }
	}

	let servId = Math.round(Math.random() * (count - 1));
	serverManager.sessions[session] = config.cluster[servId];
	return (config.cluster[servId]);
};

serverManager.addServer = () => {
	// TODO
};

serverManager.deleteServer = () => {
	// TODO
};

module.exports = serverManager;
