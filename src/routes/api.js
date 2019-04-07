import httpProxy from 'http-proxy';
import debug from 'debug';

import config from '../config';
import SessionStore from '../store';
import SessionsManager from '../core/sessions';
import ServersManager from '../core/servers';
import Database from '../database';

// Debugger
const D = debug('UnicornLoadBalancer');

let RoutesAPI = {};

// Returns all the stats of all the transcoders
RoutesAPI.stats = (req, res) => {
    res.send(ServersManager.list());
};

// Save the stats of a server
RoutesAPI.update = (req, res) => {
    res.send(ServersManager.update(req.body));
};

// Catch the FFMPEG arguments
// Body: {args: [], env: []}
RoutesAPI.ffmpeg = async (req, res) => {
    if (!req.body || !req.body.arg || !req.body.env)
        return (res.status(400).send({ error: { code: 'INVALID_ARGUMENTS', message: 'Invalid UnicornFFMPEG parameters' } }));
    
    // Detect if we are in optimizer mode
    if (req.body.arg.filter(e => (e === '-segment_list' || e === '-manifest_name')).length === 0) {
        const parsedArgs = await SessionsManager.parseFFmpegParameters(req.body.arg, req.body.env, true);
        D('FFMPEG ' + parsedArgs.session + ' [OPTIMIZE]');
        SessionsManager.saveSession(parsedArgs);
        SessionsManager.optimizerInit(parsedArgs);
        return (res.send(parsedArgs));
    }
    // Streaming mode
    else {
        const parsedArgs = await SessionsManager.parseFFmpegParameters(req.body.arg, req.body.env);
        D('FFMPEG ' + parsedArgs.session + ' [STREAMING]');
        SessionsManager.saveSession(parsedArgs)
        return (res.send(parsedArgs));
    }
};

// Resolve path from file id
RoutesAPI.path = (req, res) => {
    Database.getPartFromId(req.params.id).then((data) => {
        res.send(JSON.stringify(data));
    }).catch((err) => {
        res.status(400).send({ error: { code: 'FILE_NOT_FOUND', message: 'File not found in Plex Database' } });
    })
};

// Proxy to Plex
RoutesAPI.plex = (req, res) => {
    const proxy = httpProxy.createProxyServer({
        target: {
            host: config.plex.host,
            port: config.plex.port
        }
    }).on('error', (err) => {
        if (err.code === 'HPE_UNEXPECTED_CONTENT_LENGTH') {
            return (res.status(200).send());
        }
        res.status(400).send({ error: { code: 'PROXY_TIMEOUT', message: 'Plex not respond in time, proxy request fails' } });
    });
    req.url = req.url.slice('/api/plex'.length);
    return (proxy.web(req, res));
};

// Returns session
RoutesAPI.session = (req, res) => {
    SessionStore.get(req.params.session).then((data) => {
        res.send(data);
    }).catch(() => {
        res.status(400).send({ error: { code: 'SESSION_TIMEOUT', message: 'The session wasn\'t launched in time, request fails' } });
    })
};

// Optimizer finish
RoutesAPI.optimize = (req, res) => {
    SessionStore.get(req.params.session).then((data) => {
        SessionsManager.optimizerDownload(data).then((parsedData) => {
            SessionsManager.optimizerDelete(parsedData);
            // Todo: Self-send finish progress request
        });
        res.send(data);
    }).catch(() => {
        res.status(400).send({ error: { code: 'SESSION_TIMEOUT', message: 'Invalid session' } });
    })
};

// Export all our API routes
export default RoutesAPI;
