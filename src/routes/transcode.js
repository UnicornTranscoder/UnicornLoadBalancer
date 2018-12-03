import debug from 'debug';
import fetch from 'node-fetch';

import RoutesProxy from './proxy';
import SessionsManager from '../core/sessions';

// Debugger
const D = debug('UnicornLoadBalancer:transcode');

let RoutesTranscode = {};

/* Route to send a 302 to another server */
RoutesTranscode.redirect = async (req, res) => {
    const session = SessionsManager.getSessionFromRequest(req);
    const server = await SessionsManager.chooseServer(session, req.headers['x-forwarded-for'] || req.connection.remoteAddress);
    if (server) {
        res.writeHead(302, {
            'Location': server + req.url
        });
        res.end();
        D('Send 302 for ' + session + ' to ' + server);
    } else {
        res.status(500).send({ error: { code: 'SERVER_UNAVAILABLE', message: 'SERVER_UNAVAILABLE' } });
        D('Fail to 302 for ' + session);
    }
};

/* Route called when a DASH stream starts */
RoutesTranscode.dashStart = (req, res) => {

    // By default we don't have the session identifier
    let sessionId = false;

    // If we have a cached X-Plex-Session-Identifier, we use it
    if (req.query['X-Plex-Session-Identifier'] && SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier']))
        sessionId = SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier']);

    // Save session
    SessionsManager.cacheSessionFromRequest(req);

    // If session id available
    if (sessionId)
        SessionsManager.cleanSession(sessionId);

    // Redirect
    RoutesTranscode.redirect(req, res);
}

/* Routes called when a long polling stream starts */
RoutesTranscode.lpStart = (req, res) => {
    // Save session
    SessionsManager.cacheSessionFromRequest(req);

    // Get sessionId
    const sessionId = SessionsManager.getSessionFromRequest(req);

    // If sessionId is defined
    if (sessionId)
        SessionsManager.cleanSession(sessionId);

    // Redirect
    RoutesTranscode.redirect(req, res);
}

/* Route called when a HLS stream starts */
RoutesTranscode.hlsStart = (req, res) => {
    // Proxy to Plex
    RoutesProxy.plex(req, res);

    // Save session
    SessionsManager.cacheSessionFromRequest(req);

    // Get sessionId
    const sessionId = SessionsManager.getSessionFromRequest(req);

    // If sessionId is defined
    if (sessionId)
        SessionsManager.cleanSession(sessionId);
};

/* Route ping */
RoutesTranscode.ping = async (req, res) => {
    // Proxy to Plex
    RoutesProxy.plex(req, res);

    // Extract sessionId from request parameter
    const sessionId = SessionsManager.getSessionFromRequest(req);

    // Choose or get the server url
    const serverUrl = await SessionsManager.chooseServer(sessionId, req.headers['x-forwarded-for'] || req.connection.remoteAddress);

    // If a server url is defined, we ping the session
    if (serverUrl)
        fetch(serverUrl + '/api/ping?session=' + sessionId);
};

/* Route timeline */
RoutesTranscode.timeline = async (req, res) => {
    // Proxy to Plex
    RoutesProxy.plex(req, res);

    // Extract sessionId from request parameter
    const sessionId = SessionsManager.getSessionFromRequest(req);

    // Choose or get the server url
    const serverUrl = await SessionsManager.chooseServer(sessionId, req.headers['x-forwarded-for'] || req.connection.remoteAddress);

    // It's a stop request
    if (req.query.state === 'stopped'/* || (req.query['X-Plex-Session-Identifier'] && SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier']))*/) {
        // If a server url is defined, we stop the session
        if (serverUrl)
            fetch(serverUrl + '/api/stop?session=' + sessionId);
    }
    // it's a ping request
    else if (serverUrl) {
        fetch(serverUrl + '/api/ping?session=' + sessionId);
    }
};

/* Route stop */
RoutesTranscode.stop = async (req, res) => {
    // Proxy to plex
    RoutesProxy.plex(req, res);

    // Extract sessionId from request parameter
    const sessionId = SessionsManager.getSessionFromRequest(req);

    // Choose or get the server url
    const serverUrl = await SessionsManager.chooseServer(sessionId, req.headers['x-forwarded-for'] || req.connection.remoteAddress);

    // If a server url is defined, we stop the session
    if (serverUrl)
        fetch(serverUrl + '/api/stop?session=' + sessionId);
};

export default RoutesTranscode;
