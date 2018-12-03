import debug from 'debug';
import fetch from 'node-fetch';

import SessionsManager from '../core/sessions';
import ServersManager from '../core/servers';
import Proxy from './proxy';

// Debugger
const D = debug('UnicornLoadBalancer:transcode');

let RoutesTranscode = {};

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




/*
RoutesTranscode.ping = (req, res) => {
    SessionsManager.updateSessionFromRequest(req);

    const search = SessionsManager.parseSessionFromRequest(req);
    const session = SessionsManager.getSessionFromRequest(search);

    Proxy.plex(req, res);

    const pingRequest = (server) => {
        fetch(server + '/api/ping?session=' + session.session + '&unicorn=' + session.unicorn);
    };

    if (session.serverUrl) {
        return (pingRequest(session.serverUrl));
    }

    ServersManager.chooseServer(req.headers['x-forwarded-for'] || req.connection.remoteAddress).then((server) => {
        SessionsManager.updateSession({ ...session, serverUrl: server });
        return (pingRequest(server));
    });
};

RoutesTranscode.timeline = (req, res) => {
    SessionsManager.updateSessionFromRequest(req);

    const search = SessionsManager.parseSessionFromRequest(req);
    const session = SessionsManager.getSessionFromRequest(search);

    Proxy.plex(req, res);

    const pingRequest = (server) => {
        fetch(server + '/api/ping?session=' + session.session + '&unicorn=' + session.unicorn);
    };

    const stopRequest = (server) => {
        fetch(server + '/api/stop?session=' + session.session + '&unicorn=' + session.unicorn);
    };

    const autoRequest = (server) => {
        if (req.query.state == 'stopped')
            stopRequest(server);
        else
            pingRequest(server);
    }

    if (session.serverUrl) {
        return (autoRequest(session.serverUrl));
    }

    ServersManager.chooseServer(req.headers['x-forwarded-for'] || req.connection.remoteAddress).then((server) => {
        SessionsManager.updateSession({ ...session, serverUrl: server });
        return (autoRequest(server));
    });
};

RoutesTranscode.stop = (req, res) => {
    SessionsManager.updateSessionFromRequest(req);

    const search = SessionsManager.parseSessionFromRequest(req);
    const session = SessionsManager.getSessionFromRequest(search);

    Proxy.plex(req, res);

    const stopRequest = (server) => {
        fetch(server + '/api/stop?session=' + session.session + '&unicorn=' + session.unicorn);
    };

    if (session.serverUrl) {
        return (stopRequest(session.serverUrl));
    }

    ServersManager.chooseServer(req.headers['x-forwarded-for'] || req.connection.remoteAddress).then((server) => {
        SessionsManager.updateSession({ ...session, serverUrl: server });
        return (stopRequest(server));
    });
};

RoutesTranscode.cleanSession = (req, res, next) => {
    if (typeof req.query.session !== 'undefined') {
        D('Clean ' + req.query.session + 'from session store');
        SessionsManager.cleanSession(req.query.session)
            .then(() => {
                next();
            })
            .catch(() => {
                res.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } });
            })
    }
};

*/
export default RoutesTranscode;
