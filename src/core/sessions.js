import debug from 'debug';
import uniqid from 'uniqid';

import config from '../config';
import { publicUrl, plexUrl } from '../utils';

// Debugger
const D = debug('UnicornLoadBalancer:SessionsManager');

let SessionsManager = {};

let sessions = [
    {
        unicorn: '_UNICORN',
        session: '',
        sessionId: '',
        sessionFull: '',
        sessionIdentifier: '',
        clientIdentifier: '',
        args: [],
        env: [],
        pingUrl: ''
    }
];

// Parse request to extract session information
SessionsManager.parseSessionFromRequest = (req) => {
    const unicorn = (typeof (req.query.unicorn) !== 'undefined') ? { unicorn: req.query.unicorn } : false;
    const sessionId = (typeof (req.params.sessionId) !== 'undefined') ? { sessionId: req.params.sessionId } : false;
    const session = (typeof (req.query.session) !== 'undefined') ? { session: req.query.session } : false;
    const sessionIdentifier = (typeof (req.query['X-Plex-Session-Identifier']) !== 'undefined') ? { "X-Plex-Session-Identifier": req.query['X-Plex-Session-Identifier'] } : false;
    const clientIdentifier = (typeof (req.query['X-Plex-Client-Identifier']) !== 'undefined') ? { "X-Plex-Client-Identifier": req.query['X-Plex-Client-Identifier'] } : false;
    return {
        ...unicorn,
        ...sessionId,
        ...session,
        ...sessionIdentifier,
        ...clientIdentifier
    }
};

// Get a session from its values
SessionsManager.getSessionFromRequest = (search) => {
    const filtered = sessions.filter(e => {
        let keys = Object.keys(search);
        for (let i = 0; i < keys.length; i++) {
            if (e[keys[i]] === search[keys[i]])
                return (true);
        }
        return (false);
    });
    if (filtered.length === 0)
        return (false);
    return (filtered[0]);
};

// Get a session position from its values
SessionsManager.getIdFromRequest = (search) => {
    for (let idx = 0; idx < sessions.length; idx++) {
        let keys = Object.keys(search);
        for (let i = 0; i < keys.length; i++) {
            if (e[keys[i]] === search[keys[i]])
                return (idx);
        }
    }
    return (false);
};

// Update the session stored
SessionsManager.updateSessionFromRequest = (req) => {
    const args = SessionsManager.parseSessionFromRequest(req);
    const search = SessionsManager.getSessionFromRequest(search);
    const idx = SessionsManager.getIdFromRequest(search);

    if (!search) {
        sessions.push({
            ...{
                unicorn: uniqid(),
                session: '',
                sessionId: '',
                sessionFull: '',
                sessionIdentifier: '',
                clientIdentifier: '',
                args: [],
                env: [],
                pingUrl: ''
            },
            ...args
        });
        return (true);
    }
    sessions[idx] = {
        ...sessions[idx],
        ...args
    };
    return (false);
};

// Parse FFmpeg parameters with internal bindings
SessionsManager.parseFFmpegParameters = (args) => {
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
            return (e.replace(plexUrl(), publicUrl()));

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
    return (finalArgs);
}

// Store the FFMPEG parameters in RedisCache
SessionsManager.storeFFmpegParameters = (args, env) => {
    const parsedArguments = SessionsManager.parseFFmpegParameters(args);
    return (parsedArguments);
};

// Export our SessionsManager
export default SessionsManager;