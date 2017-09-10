/**
 * Created by Maxime Baconnais on 10/09/2017.
 */

const debug = require('debug')('redirect');
const request = require('request');

const chooseServer = require('./chooseServer');
const getSession = require('../utils/getSession');
const getIp = require('../utils/getIp');
const proxy = require('../core/proxy');

const proxyPlex = (req, res) => {
    proxy.web(req, res)
};

const forward = (req, res) => {

	const sessionId = getSession(req);
	const ip = getIp(req);
	const serverUrl = chooseServer(sessionId, ip);

	// Prody to plex
	proxyPlex(req, res);
	
	// Send request to transcoder
	request(serverUrl + req.url);

	// Debug
	debug('Forward session ' + sessionId + ' to Plex and ' + serverUrl);
}

module.exports = forward;
