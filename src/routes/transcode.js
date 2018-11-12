import debug from 'debug';
import fetch from 'node-fetch';

import SessionsManager from '../core/sessions';
import ServersManager from '../core/servers';
import Proxy from './proxy';

// Debugger
const D = debug('UnicornLoadBalancer:transcode');

let RoutesTranscode = {};

RoutesTranscode.redirect = (req, res) => {
    SessionsManager.updateSessionFromRequest(req);

    const search = SessionsManager.parseSessionFromRequest(req);
    const session = SessionsManager.getSessionFromRequest(search);

    const redirectRequest = (server) => {
        if (server) {
            res.writeHead(302, {
                'Location': (server + req.url + '&unicorn=' + session.unicorn)
            });
            res.end();
            D('Send 302 for ' + session.session + ' to ' + server);
            return;
        }
        D('Fail to 302 for ' + session.session + ' to ' + server);
    };

    if (session.serverUrl) {
        return (redirectRequest(session.serverUrl));
    }

    ServersManager.chooseServer(req.connection.remoteAddress).then((server) => {
        SessionsManager.updateSession({ ...session, serverUrl: server });
        return (redirectRequest(server));
    });
};

RoutesTranscode.ping = (req, res) => {
    SessionsManager.updateSessionFromRequest(req);

    const search = SessionsManager.parseSessionFromRequest(req);
    const session = SessionsManager.getSessionFromRequest(search);

    req.url += '&unicorn=' + session.unicorn;
    Proxy.plex(req, res);

    const pingRequest = (server) => {
        fetch(server + '/api/ping?session=' + session.session + '&unicorn=' + session.unicorn);
    };

    if (session.serverUrl) {
        return (pingRequest(session.serverUrl));
    }

    ServersManager.chooseServer(req.connection.remoteAddress).then((server) => {
        SessionsManager.updateSession({ ...session, serverUrl: server });
        return (pingRequest(server));
    });
};

RoutesTranscode.timeline = (req, res) => {
    SessionsManager.updateSessionFromRequest(req);

    const search = SessionsManager.parseSessionFromRequest(req);
    const session = SessionsManager.getSessionFromRequest(search);

    req.url += '&unicorn=' + session.unicorn;
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

    ServersManager.chooseServer(req.connection.remoteAddress).then((server) => {
        SessionsManager.updateSession({ ...session, serverUrl: server });
        return (autoRequest(server));
    });
};

RoutesTranscode.stop = (req, res) => {
    SessionsManager.updateSessionFromRequest(req);

    const search = SessionsManager.parseSessionFromRequest(req);
    const session = SessionsManager.getSessionFromRequest(search);

    req.url += '&unicorn=' + session.unicorn;
    Proxy.plex(req, res);

    const stopRequest = (server) => {
        fetch(server + '/api/stop?session=' + session.session + '&unicorn=' + session.unicorn);
    };

    if (session.serverUrl) {
        return (stopRequest(session.serverUrl));
    }

    ServersManager.chooseServer(req.connection.remoteAddress).then((server) => {
        SessionsManager.updateSession({ ...session, serverUrl: server });
        return (stopRequest(server));
    });
};

export default RoutesTranscode;