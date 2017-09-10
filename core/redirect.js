/**
 * Created by Maxime Baconnais on 29/08/2017.
 */

const debug = require('debug')('redirect');

const serverManager = require('./serverManager');
const getIp = require('../utils/getIp');

let redirect = (req, res) => {
	const sessionId = serverManager.getSession(req);
	const serverUrl = serverManager.chooseServer(sessionId, getIp(req));

	res.writeHead(302, {
		'Location': serverUrl + req.url
	});
	res.end();
	
	debug('Send 302 for ' + sessionId + ' to ' + serverUrl);
}

module.exports = redirect;
