import debug from 'debug';
import uniqid from 'uniqid';

import config from '../config';
import { publicUrl, plexUrl } from '../utils';
import SessionStore from '../store';

// Debugger
const D = debug('UnicornLoadBalancer:SessionsManager');

let SessionsManager = {};

let sessions = [
];

SessionsManager.list = () => {
    return (sessions);
};

// Parse request to extract session information
SessionsManager.parseSessionFromRequest = (req) => {
    const unicorn = (typeof (req.query) !== 'undefined' && typeof (req.query.unicorn) !== 'undefined') ? { unicorn: req.query.unicorn } : false;
    const session = (typeof (req.params.sessionId) !== 'undefined') ? { session: req.params.sessionId } : ((typeof (req.query.session) !== 'undefined') ? { session: req.query.session } : false);
    const sessionIdentifier = (typeof (req.query['X-Plex-Session-Identifier']) !== 'undefined') ? { sessionIdentifier: req.query['X-Plex-Session-Identifier'] } : false;
    const clientIdentifier = (typeof (req.query['X-Plex-Client-Identifier']) !== 'undefined') ? { clientIdentifier: req.query['X-Plex-Client-Identifier'] } : false;
    return {
        ...unicorn,
        ...session,
        ...sessionIdentifier,
        ...clientIdentifier
    }
};

// Get a session from its values
SessionsManager.getSessionFromRequest = (search) => {
    const sessionIndex = SessionsManager.getIdFromRequest(search);
    if (sessionIndex === false)
        return (false);
    return (sessions[sessionIndex]);
};

// Get a session position from its values
SessionsManager.getIdFromRequest = (search) => {

    // List of keys could be used to identify a session
    let keys = ['session', 'sessionIdentifier'];

    // Reverse session to start by the end
    const rsessions = sessions.slice().reverse();

    // Filter sessions
    for (let idx = 0; idx < rsessions.length; idx++) {
        for (let i = 0; i < keys.length; i++) {
            if (rsessions[idx][keys[i]] && search[keys[i]] && rsessions[idx][keys[i]] === search[keys[i]])
                return (idx);
        }
    }

    //keys = ['sessionIdentifier', 'clientIdentifier'];

    /*for (let idx = 0; idx < rsessions.length; idx++) {
        for (let i = 0; i < keys.length; i++) {
            if (rsessions[idx][keys[i]] && search[keys[i]] && rsessions[idx][keys[i]] === search[keys[i]])
                return (idx);
        }
    }*/

    // Android case, no session, only a sessionIdentifier
    //if (!search.session && search.sessionIdentifier)
    //    return (SessionsManager.getIdFromRequest({ ...search, session: search.sessionIdentifier }));

    // Ok, Android really sucks, other case, no session, only a clientIdentifier
    if (!search.session && search.clientIdentifier)
        return (SessionsManager.getIdFromRequest({ ...search, session: search.clientIdentifier }));

    // Not be found
    return (false);
};

// Update the session stored
SessionsManager.updateSessionFromRequest = (req) => {
    const args = SessionsManager.parseSessionFromRequest(req);
    return (SessionsManager.updateSession(args));
};

// Update a session
SessionsManager.updateSession = (args) => {
    const search = SessionsManager.getSessionFromRequest(args);
    const idx = SessionsManager.getIdFromRequest(args);

    // Avoid to create empty session objects (Download case by example)
    if (!args.session && !args.sessionFull && !args.sessionIdentifier && !args.clientIdentifier)
        return (false);

    if (!search) {
        sessions.push({
            unicorn: uniqid(),
            session: '',
            sessionFull: '',
            sessionIdentifier: '',
            clientIdentifier: '',
            args: [],
            env: [],
            serverUrl: '',
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
    SessionsManager.updateSession(parsed);
    const session = SessionsManager.getSessionFromRequest({
        session: parsed.session,
        sessionFull: parsed.sessionFull
    });
    SessionStore.set(session.session, session).then(() => {

    }).catch((err) => {

    })
    return (parsed);
};

SessionsManager.cleanSession = (sessionId) => {
    return SessionStore.delete(sessionId)
};

// Export our SessionsManager
export default SessionsManager;
