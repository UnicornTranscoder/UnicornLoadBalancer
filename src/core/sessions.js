import debug from 'debug';

import config from '../config';
import { publicUrl, plexUrl } from '../utils';
import SessionStore from '../store';
import ServersManager from './servers';

// Debugger
const D = debug('UnicornLoadBalancer:SessionsManager');

let SessionsManager = {};

let sessions = [
];

// Plex table to match "session" and "X-Plex-Session-Identifier"
let cache = {};

// Table to link session to transcoder url
let urls = {}

// list all the sessions
SessionsManager.list = () => {
    return (sessions);
};

SessionsManager.chooseServer = async (session, ip = false) => {
    if (session === false)
        return (false);
    if (urls[session])
        return (urls[session]);
    const url = await ServersManager.chooseServer(ip);
    urls[session] = url;
    return (url);
};

SessionsManager.cacheSessionFromRequest = (req) => {
    if (typeof (req.query['X-Plex-Session-Identifier']) !== 'undefined' && typeof (req.query.session) !== 'undefined') {
        cache[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
    }
}

SessionsManager.getCacheSession = (xplexsessionidentifier) => {
    if (cache[xplexsessionidentifier])
        return (cache[xplexsessionidentifier]);
    return (false);
}

SessionsManager.getSessionFromRequest = (req) => {
    if (typeof (req.params.sessionId) !== 'undefined')
        return (req.params.sessionId);
    if (typeof (req.query.session) !== 'undefined')
        return (req.query.session);
    if (typeof (req.query['X-Plex-Session-Identifier']) !== 'undefined' && typeof (cache[req.query['X-Plex-Session-Identifier']]) !== 'undefined')
        return (cache[req.query['X-Plex-Session-Identifier']]);
    if (typeof (req.query['X-Plex-Session-Identifier']) !== 'undefined')
        return (req.query['X-Plex-Session-Identifier']);
    if (typeof (req.query['X-Plex-Client-Identifier']) !== 'undefined')
        return (req.query['X-Plex-Client-Identifier']);
    return (false);
}

// Parse FFmpeg parameters with internal bindings
SessionsManager.parseFFmpegParameters = (args = [], env = {}) => {
    // Extract Session ID
    const regex = /^http\:\/\/127.0.0.1:32400\/video\/:\/transcode\/session\/(.*)\/progress$/;
    const sessions = args.filter(e => (regex.test(e))).map(e => (e.match(regex)[1]))
    const sessionFull = (typeof (sessions[0]) !== 'undefined') ? sessions[0] : false;
    const sessionId = (typeof (sessions[0]) !== 'undefined') ? sessions[0].split('/')[0] : false;

    // Check Session Id
    if (!sessionId || !sessionFull)
        return (false);

    // Debug
    D('Session found: ' + sessionId + ' (' + sessionFull + ')');

    // Parse arguments
    const parsedArgs = args.map((e) => {

        // Progress
        if (e.indexOf('/progress') !== -1)
            return (e.replace(plexUrl(), '{INTERNAL_TRANSCODER}'));

        // Manifest and seglist
        if (e.indexOf('/manifest') !== -1 || e.indexOf('/seglist') !== -1)
            return (e.replace(plexUrl(), '{INTERNAL_TRANSCODER}'));

        // Other
        return (e.replace(plexUrl(), publicUrl()).replace(config.plex.path.sessions, publicUrl() + 'api/sessions/').replace(config.plex.path.usr, '{INTERNAL_RESOURCES}'));
    });

    // Add seglist to arguments if needed
    const segList = '{INTERNAL_TRANSCODER}video/:/transcode/session/' + sessionFull + '/seglist';
    let finalArgs = [];
    let segListMode = false;
    parsedArgs.forEach((e, i) => {
        if (e === '-segment_list') {
            segListMode = true;
            finalArgs.push(e);
            return (true);
        }
        if (segListMode) {
            finalArgs.push(segList);
            if (parsedArgs[i + 1] !== '-segment_list_type')
                finalArgs.push('-segment_list_type', 'csv', '-segment_list_size', '2147483647');
            segListMode = false;
            return (true);
        }
        finalArgs.push(e);
    });
    return ({
        args: finalArgs,
        env,
        session: sessionId,
        sessionFull
    });
};

// Store the FFMPEG parameters in RedisCache
SessionsManager.storeFFmpegParameters = (args, env) => {
    const parsed = SessionsManager.parseFFmpegParameters(args, env);
    SessionStore.set(parsed.session, parsed).then(() => { }).catch(() => { })
    return (parsed);
};

SessionsManager.cleanSession = (sessionId) => {
    return SessionStore.delete(sessionId)
};

// Export our SessionsManager
export default SessionsManager;
