import config from '../config';
import SessionsManager from '../core/sessions';
import ServersManager from '../core/servers';

let RoutesTranscode = {};

RoutesTranscode.redirect = (req, res) => {
    //SessionsManager.updateSessionFromRequest(req);

    // Choose server

    // 302 Bro'
};

RoutesTranscode.ping = (req, res) => {
    /*proxy.web(req, res);

    const sessionId = serverManager.getSession(req);
    const serverUrl = serverManager.chooseServer(sessionId, getIp(req));

    if (typeof (serverUrl) !== 'undefined')
        request(serverUrl + '/video/:/transcode/universal/ping?session=' + sessionId);*/
};

RoutesTranscode.timeline = (req, res) => {

    /*if (req.query.state == 'stopped' || (typeof (req.query['X-Plex-Session-Identifier']) !== 'undefined' && typeof (serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']]) != 'undefined')) {
        request(serverUrl + '/video/:/transcode/universal/stop?session=' + sessionId);
    }
    else {
        proxy.web(req, res);
    }*/
};

export default RoutesTranscode;