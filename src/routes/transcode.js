import config from '../config';
import SessionsManager from '../core/sessions';
import ServersManager from '../core/servers';

let RoutesTranscode = {};

// TODO: Some stuff to do here :P

RoutesTranscode.redirect = (req, res) => {
    SessionsManager.updateSessionFromRequest(req);

    // Choose server if we don't have (check in server manager)
    // Save server in sessionManager

    ServersManager.chooseServer(req.connection.remoteAddress);

    /*res.writeHead(302, {
		'Location': serverUrl + req.url + '&unicorn=' + UNICORNID
	});
	res.end();
	
	debug('Send 302 for ' + sessionId + ' to ' + serverUrl);*/
};

RoutesTranscode.ping = (req, res) => {
    /*proxy.web(req, res); // + '&unicorn=' + UNICORNID

    const sessionId = serverManager.getSession(req);
    const serverUrl = serverManager.chooseServer(sessionId, getIp(req));

    if (typeof (serverUrl) !== 'undefined')
        request(serverUrl + '/video/:/transcode/universal/ping?session=' + sessionId);*/// + '&unicorn=' + UNICORNID
};

RoutesTranscode.timeline = (req, res) => {

    //  /!\ Need to catch Dash end here

    /*if (req.query.state == 'stopped' || (typeof (req.query['X-Plex-Session-Identifier']) !== 'undefined' && typeof (serverManager.stoppedSessions[req.query['X-Plex-Session-Identifier']]) != 'undefined')) {
        request(serverUrl + '/video/:/transcode/universal/stop?session=' + sessionId);// + '&unicorn=' + UNICORNID
    }
    else {
        proxy.web(req, res);
    }*/
};

RoutesTranscode.stop = (req, res) => {

    // ???
};

export default RoutesTranscode;