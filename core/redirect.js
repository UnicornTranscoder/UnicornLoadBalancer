/**
 * Created by Maxime Baconnais on 29/08/2017.
 */

const debug = require('debug')('redirect');

const chooseServer = require('./chooseServer');
const getSession = require('../utils/getSession');
const getIp = require('../utils/getIp');

let redirect = (req, res) => {

	const sessionId = getSession(req);
	const ip = getIp(req);
	const serverUrl = chooseServer(sessionId, ip);
	
    debug('SESSIONID ' + sessionId);

	
	res.writeHead(302, {
		'Location': serverUrl + req.url
	});
	res.end();
	debug('Send 302 to ' + serverUrl);
}

module.exports = redirect;
