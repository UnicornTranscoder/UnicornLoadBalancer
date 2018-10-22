import debug from 'debug';

import config from '../config';
import { publicUrl, plexUrl, redis } from '../utils';

// Debugger
const D = debug('UnicornLoadBalancer:SessionsManager');

let SessionsManager = {};

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
    redis.set(propersessionid, JSON.stringify({
        args: parsedArguments,
        env
    }));
    return (parsedArguments);
};

// Export our SessionsManager
export default SessionsManager;