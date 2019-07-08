import debug from 'debug';
import fetch from 'node-fetch';
import RoutesProxy from './proxy';
import Database from '../database';
import SessionsManager from '../core/sessions';

// Debugger
const D = debug('UnicornLoadBalancer');

let RoutesTranscode = {};

/* Extract IP */
const getIp = (req) => {
    if (req.get('CF-Connecting-IP'))
        return req.get('CF-Connecting-IP');
    if (req.get('x-forwarded-for'))
        return req.get('x-forwarded-for').split(',')[0];
    return req.connection.remoteAddress
};

/* Route to send a 302 to another server */
RoutesTranscode.redirect = async (req, res) => {
    const session = SessionsManager.getSessionFromRequest(req);
    const server = await SessionsManager.chooseServer(session, getIp(req));
    if (server) {
        res.redirect(302, server + req.url);
        D('REDIRECT ' + session + ' [' + server + ']');
    } else {
        res.status(500).send({ error: { code: 'SERVER_UNAVAILABLE', message: 'SERVER_UNAVAILABLE' } });
        D('REDIRECT ' + session + ' [UNKNOWN]');
    }
};

/* Route called when a DASH stream starts */
RoutesTranscode.dashStart = (req, res) => {
    // By default we don't have the session identifier
    let sessionId = false;

    // If we have a cached X-Plex-Session-Identifier, we use it
    if (req.query['X-Plex-Session-Identifier'] && SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier']))
        sessionId = SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier']);

    // Log
    D('START ' + SessionsManager.getSessionFromRequest(req) + ' [DASH]');

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

    // Log
    D('START ' + sessionId + ' [LP]');

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

    // Log
    D('START ' + sessionId + ' [HLS]');

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
    const serverUrl = await SessionsManager.chooseServer(sessionId, getIp(req));

    // If a server url is defined, we ping the session
    if (serverUrl) {
        D('PING ' + sessionId + ' [' + serverUrl + ']');
        fetch(serverUrl + '/api/ping?session=' + sessionId);
    } else {
        D('PING ' + sessionId + ' [UNKNOWN]');
    }
};

/* Route timeline */
RoutesTranscode.timeline = async (req, res) => {
    // Proxy to Plex
    RoutesProxy.plex(req, res);

    // Extract sessionId from request parameter
    const sessionId = SessionsManager.getSessionFromRequest(req);

    // Choose or get the server url
    const serverUrl = await SessionsManager.chooseServer(sessionId, getIp(req));

    // It's a stop request
    if (req.query.state === 'stopped') {
        // If a server url is defined, we stop the session
        if (serverUrl) {
            D('STOP ' + sessionId + ' [' + serverUrl + ']');
            fetch(serverUrl + '/api/stop?session=' + sessionId);
        } else {
            D('STOP ' + sessionId + ' [UNKNOWN]');
        }
    }
    // It's a ping request
    else {
        if (serverUrl) {
            D('PING ' + sessionId + ' [' + serverUrl + ']');
            fetch(serverUrl + '/api/ping?session=' + sessionId);
        } else {
            D('PING ' + sessionId + ' [UNKNOWN]');
        }
    }
};

/* Route stop */
RoutesTranscode.stop = async (req, res) => {
    // Proxy to plex
    RoutesProxy.plex(req, res);

    // Extract sessionId from request parameter
    const sessionId = SessionsManager.getSessionFromRequest(req);

    // Choose or get the server url
    const serverUrl = await SessionsManager.chooseServer(sessionId, getIp(req));

    // If a server url is defined, we stop the session
    if (serverUrl) {
        D('STOP ' + sessionId + ' [' + serverUrl + ']');
        fetch(serverUrl + '/api/stop?session=' + sessionId);
    } else {
        D('STOP ' + sessionId + ' [UNKNOWN]');
    }
};

/* Route download */
RoutesTranscode.download = (req, res) => {
    D('DOWNLOAD ' + req.params.id1 + ' [LB]');
    Database.getPartFromId(req.params.id1).then((data) => {
        res.sendFile(data.file, {}, (err) => {
            if (err && err.code !== 'ECONNABORTED')
                D('DOWNLOAD FAILED ' + req.params.id1 + ' [LB]');
        })
    }).catch((err) => {
        res.status(400).send({ error: { code: 'NOT_FOUND', message: 'File not available' } });
    })
};

export default RoutesTranscode;
