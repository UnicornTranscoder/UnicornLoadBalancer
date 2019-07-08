import debug from 'debug';
import config from '../config';
import { publicUrl, plexUrl, download, mdir, replaceAll } from '../utils';
import { dirname } from 'path';
import SessionStore from '../store';
import ServersManager from './servers';
import Database from '../database';
import fetch from 'node-fetch';
import uniqid from 'uniqid';

// Debugger
const D = debug('UnicornLoadBalancer');

let SessionsManager = {};

// Plex table to match "session" and "X-Plex-Session-Identifier"
let cache = {};

let ffmpegCache = {};

// Table to link session to transcoder url
let urls = {};

SessionsManager.chooseServer = async (session, ip = false) => {
    if (session && urls[session])
        return (urls[session]);
    let url = '';
    try {
        url = await ServersManager.chooseServer(session, ip);
    }
    catch (err) { }
    D('SERVER ' + session + ' [' + url + ']');
    if (session && url.length)
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
SessionsManager.parseFFmpegParameters = async (args = [], env = {}, optimizeMode = false) => {
    // Extract Session ID
    const regex = /^http\:\/\/127.0.0.1:32400\/video\/:\/transcode\/session\/(.*)\/progress$/;
    const sessions = args.filter(e => (regex.test(e))).map(e => (e.match(regex)[1]))
    const sessionFull = (typeof (sessions[0]) !== 'undefined') ? sessions[0] : false;
    const sessionId = (typeof (sessions[0]) !== 'undefined') ? sessions[0].split('/')[0] : false;

    // Check Session Id
    if (!sessionId || !sessionFull)
        return (false);

    // Debug
    D('FFMPEG ' + sessionId + ' [' + sessionFull + ']');

    // Parse arguments
    const parsedArgs = args.map((e) => {

        // Progress
        if (e.indexOf('/progress') !== -1)
            return (e.replace(plexUrl(), '{INTERNAL_TRANSCODER}'));

        // Manifest and seglist
        if (e.indexOf('/manifest') !== -1 || e.indexOf('/seglist') !== -1)
            return (e.replace(plexUrl(), '{INTERNAL_TRANSCODER}'));

        // Other
        let parsed = e;
        parsed = replaceAll(parsed, plexUrl(), publicUrl())
        parsed = replaceAll(parsed, config.plex.path.sessions, publicUrl() + 'api/sessions/')
        parsed = replaceAll(parsed, config.plex.path.usr, '{INTERNAL_PLEX_SETUP}')
        return parsed;
    });

    // Add seglist to arguments if needed and resolve links if needed
    const segList = '{INTERNAL_TRANSCODER}video/:/transcode/session/' + sessionFull + '/seglist';
    let finalArgs = [];
    let optimize = {};
    let segListMode = false;
    for (let i = 0; i < parsedArgs.length; i++) {
        let e = parsedArgs[i];

        // Seglist
        if (e === '-segment_list') {
            segListMode = true;
            finalArgs.push(e);
            continue;
        }
        if (segListMode) {
            finalArgs.push(segList);
            if (parsedArgs[i + 1] !== '-segment_list_type')
                finalArgs.push('-segment_list_type', 'csv', '-segment_list_size', '2147483647');
            segListMode = false;
            continue;
        }

        // Optimize, replace optimize path
        if (optimizeMode && i > 0 && parsedArgs[i - 1] !== '-i' && e[0] === '/') {
            finalArgs.push(`{OPTIMIZE_PATH}${e.split('/').slice(-1).pop()}`);
            optimize[e.split('/').slice(-1).pop()] = e;
            continue;
        }

        // Link resolver (Replace filepath to http plex path)
        if (i > 0 && parsedArgs[i - 1] === '-i' && !config.custom.download.forward) {
            let file = parsedArgs[i];
            try {
                const data = await Database.getPartFromPath(parsedArgs[i]);
                if (typeof (data.id) !== 'undefined')
                    file = `${publicUrl()}library/parts/${data.id}/0/file.stream?download=1`;
            } catch (e) {
                file = parsedArgs[i];
            }
            finalArgs.push(file);
            continue;
        }

        // Link resolver (Replace Plex file url by direct file)
        if (i > 0 && parsedArgs[i - 1] === '-i' && config.custom.download.forward) {
            let file = parsedArgs[i];
            let partId = false;
            if (file.indexOf('library/parts/') !== -1) {
                partId = file.split('library/parts/')[1].split('/')[0];
            }
            if (!partId) {
                finalArgs.push(file);
                continue;
            }
            try {
                const data = await Database.getPartFromId(partId);
                if (typeof (data.file) !== 'undefined' && data.file.length)
                    file = data.file;
            } catch (e) {
                file = parsedArgs[i];
            }
            finalArgs.push(file);
            continue
        }

        // Ignore parameter
        finalArgs.push(e);
    };
    return ({
        id: uniqid(),
        args: finalArgs,
        env,
        session: sessionId,
        sessionFull,
        optimize
    });
};

// Store the FFMPEG parameters in RedisCache
SessionsManager.saveSession = (parsed) => {
    SessionStore.set(parsed.session, parsed).then(() => { }).catch(() => { })
};

// Call media optimizer on transcoders
SessionsManager.optimizerInit = async (parsed) => {
    D(`OPTIMIZER ${parsed.session} [START]`);
    const server = await ServersManager.chooseServer(parsed.session, false)
    fetch(`${server}/api/optimize`, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify(parsed)
    })
    return parsed;
};

// Call media optimizer on transcoders
SessionsManager.optimizerDelete = async (parsed) => {
    D(`OPTIMIZER ${parsed.session} [DELETE]`);
    SessionsManager.ffmpegSetCache(parsed.id, 0);
    const server = await ServersManager.chooseServer(parsed.session, false)
    fetch(`${server}/api/optimize/${parsed.session}`, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        method: 'DELETE',
        body: JSON.stringify(parsed)
    });
    SessionsManager.cleanSession(parsed.session);
    return parsed;
};

// Callback of the optimizer server
SessionsManager.optimizerDownload = (parsed) => (new Promise(async (resolve, reject) => {
    const files = Object.keys(parsed.optimize);
    const server = await SessionsManager.chooseServer(parsed.session);
    for (let i = 0; i < files.length; i++) {
        D(`OPTIMIZER ${server}/api/optimize/${parsed.session}/${encodeURIComponent(files[i])} [DOWNLOAD]`);
        try {
            await mdir(dirname(parsed.optimize[files[i]]));
        }
        catch (err) {
            D(`OPTIMIZER Failed to create directory`);
        }
        try {
            await download(`${server}/api/optimize/${parsed.session}/${encodeURIComponent(files[i])}`, parsed.optimize[files[i]])
        }
        catch (err) {
            D(`OPTIMIZER ${server}/api/optimize/${parsed.session}/${encodeURIComponent(files[i])} [FAILED]`);
        }
    }
    resolve(parsed);
}));

// Clear session
SessionsManager.cleanSession = (sessionId) => {
    D('DELETE ' + sessionId);
    return SessionStore.delete(sessionId)
};

// Set FFmpeg cache
SessionsManager.ffmpegSetCache = (id, status) => {
    ffmpegCache[id] = status;
    return ffmpegCache[id];
};

// Get FFmpeg cache
SessionsManager.ffmpegGetCache = (id) => {
    if (typeof (ffmpegCache[id]) !== 'undefined')
        return ffmpegCache[id];
    return false;
};

// Export our SessionsManager
export default SessionsManager;
