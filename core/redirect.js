/**
 * Created by Maxime Baconnais on 29/08/2017.
 */

const debug = require('debug')('redirect');

const chooseServer = require('./chooseServer');
const getSession = require('../utils/getSession');

let redirect = (req, res) => {

res.header('Access-Control-Allow-Origin', '*');
	const sessionId = getSession(req);
	
    debug('SESSIONID ' + sessionId);
	console.log('SESSIONID ' + sessionId + "\n");
	const serverUrl = chooseServer(sessionId, req.connection.remoteAddress);
	res.writeHead(302, {
		'Location': serverUrl + req.url
	});
	res.end();
	debug('Send 302 to ' + serverUrl);
}

module.exports = redirect;
