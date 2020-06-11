import express from 'express';

import config from '../config';
import RoutesAPI from './api';
import RoutesTranscode from './transcode';
import RoutesProxy from './proxy';
import RoutesResize from './resize';
import { createProxy, patchDashManifest, getIp } from '../core/patch';
import SessionsManager from '../core/sessions';

export default (app) => {

    // Note for future:
    // We NEED to 302/307 the chunk requests because if Plex catchs it with fake transcoder, it stucks

    // UnicornLoadBalancer API
    app.use('/api/sessions', express.static(config.plex.path.sessions));
    app.get('/api/stats', RoutesAPI.stats);
    app.post('/api/ffmpeg', RoutesAPI.ffmpeg);
    app.get('/api/ffmpeg/:id', RoutesAPI.ffmpegStatus);
    app.get('/api/path/:id', RoutesAPI.path);
    app.post('/api/update', RoutesAPI.update);
    app.get('/api/session/:session', RoutesAPI.session);
    app.patch('/api/optimize/:session', RoutesAPI.optimize);
    app.all('/api/plex/*', RoutesAPI.plex);

    // MPEG Dash support
    app.get('/:formatType/:/transcode/universal/start.mpd', createProxy(10000, async (req) => {

        let sessionId = false;

        // If we have a cached X-Plex-Session-Identifier, we use it
        if (req.query['X-Plex-Session-Identifier'] && SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier'])) {
            sessionId = SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier']);
        }

        // Log
        // D('START ' + SessionsManager.getSessionFromRequest(req) + ' [DASH]');

        // Save session
        SessionsManager.cacheSessionFromRequest(req);

        // If session id available
        if (sessionId) {
            SessionsManager.cleanSession(sessionId);
        }

        // Todo: Call transcoder using API to ask to start the session

        return { sessionId }

    }, async (req, body, initialData) => {
        // Get server url
        const server = await SessionsManager.chooseServer(initialData.sessionId, getIp(req));

        // Return patched manifest
        return patchDashManifest(body, server);
    }));

    app.get('/:formatType/:/transcode/universal/dash/:sessionId/:streamId/initial.mp4', RoutesTranscode.redirect); // Todo Replace by Unicorn Page
    app.get('/:formatType/:/transcode/universal/dash/:sessionId/:streamId/:partId.m4s', RoutesTranscode.redirect); // Todo Replace by Unicorn Page

    // Long polling support
    app.get('/:formatType/:/transcode/universal/start', RoutesTranscode.lpStart); // Should keep 302...
    app.get('/:formatType/:/transcode/universal/subtitles', RoutesTranscode.redirect);

    // M3U8 support
    app.get('/:formatType/:/transcode/universal/start.m3u8', RoutesTranscode.hlsStart);
    app.get('/:formatType/:/transcode/universal/session/:sessionId/base/index.m3u8', RoutesTranscode.redirect);
    app.get('/:formatType/:/transcode/universal/session/:sessionId/base-x-mc/index.m3u8', RoutesTranscode.redirect);
    app.get('/:formatType/:/transcode/universal/session/:sessionId/:fileType/:partId.ts', RoutesTranscode.redirect);
    app.get('/:formatType/:/transcode/universal/session/:sessionId/:fileType/:partId.vtt', RoutesTranscode.redirect);

    // Control support
    app.get('/:formatType/:/transcode/universal/stop', RoutesTranscode.stop);
    app.get('/:formatType/:/transcode/universal/ping', RoutesTranscode.ping);
    app.get('/:/timeline', RoutesTranscode.timeline);

    // Download
    if (config.custom.download.forward) {
        app.get('/library/parts/:id1/:id2/file.*', RoutesTranscode.redirect);
    }
    if (!config.custom.download.forward) {
        app.get('/library/parts/:id1/:id2/file.*', RoutesTranscode.download);
    }

    // Image Proxy or Image Resizer
    if (config.custom.image.proxy) {
        app.get('/photo/:/transcode', RoutesResize.proxy);
    }

    // Forward other to Plex
    app.all('*', createProxy(10000));
};
