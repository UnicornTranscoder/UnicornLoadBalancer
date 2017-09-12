/**
 * Created by Maxime Baconnais on 29/08/2017.
 */
 
const config = require('../config');

let serverManager = {}

serverManager.cacheSession = {};

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
	return (false);
}

serverManager.chooseServer = (session, ip) => {
	if (ip === '91.121.222.224' || ip === '5.49.105.160')
		return (config.cluster[1]);
	return (config.cluster[0]);
};

serverManager.addServer = () => {
	// TODO
};

serverManager.deleteServer = () => {
	// TODO
};

module.exports = serverManager;
