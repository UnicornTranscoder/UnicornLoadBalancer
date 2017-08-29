/**
 * Created by Maxime Baconnais on 29/08/2017.
 */

const debug = require('debug')('redirect');

const chooseServer = require('./chooseServer');

let redirect = (req, res) => {
	
	let sessionId = false;
	if (typeof(req.params.sessionId) !== 'undefined')
		sessionId = req.params.sessionId;
	else if (typeof(req.query.session) !== 'undefined')
		sessionId = req.query.session;
	else if (typeof(req.query['X-Plex-Session-Identifier']) !== 'undefined')
		sessionId = req.query['X-Plex-Session-Identifier'];
	
    debug('SESSIONID ' + sessionId);
	console.log('SESSIONID ' + sessionId + "\n");
	const serverUrl = chooseServer(sessionId);
	res.writeHead(302, {
		'Location': serverUrl + req.url
	});
	res.end();
	debug('Send 302 to ' + serverUrl);
}

module.exports = redirect;