import express from 'express';
import fetch from 'node-fetch';

import config from '../config';
import RoutesAPI from './api';
import RoutesTranscode from './transcode';
import RoutesProxy from './proxy';
import SessionsManager from '../core/sessions';

export default (app) => {

    // Note for future:
    // We NEED to 302 the chunk requests because if Plex catchs it with fake transcoder, it stucks

    // UnicornLoadBalancer API
    app.use('/api/sessions', express.static(config.plex.path.sessions));
    app.use('/api/debug', RoutesAPI.sessions);
    app.get('/api/stats', RoutesAPI.stats);
    app.post('/api/ffmpeg', RoutesAPI.ffmpeg);
    app.get('/api/path/:id', RoutesAPI.path);
    app.post('/api/update', RoutesAPI.update);
    app.get('/api/session/:session', RoutesAPI.session);
    app.all('/api/plex/*', RoutesAPI.plex);

    //---------------------------------------------

    // MPEG Dash support
    app.get('/:formatType/:/transcode/universal/start.mpd', (req, res) => {

        // By default we don't have the session identifier
        let sessionId = false;

        // If we have a cached X-Plex-Session-Identifier, we use it
        if (req.query['X-Plex-Session-Identifier'] && SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier']))
            sessionId = SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier']);

        // Save session
        SessionsManager.cacheSessionFromRequest(req);

        // If session id available
        if (sessionId)
            SessionsManager.cleanSession(sessionId);

        // Redirect
        RoutesTranscode.redirect(req, res);
    });
    app.get('/:formatType/:/transcode/universal/dash/:sessionId/:streamId/initial.mp4', RoutesTranscode.redirect);
    app.get('/:formatType/:/transcode/universal/dash/:sessionId/:streamId/:partId.m4s', RoutesTranscode.redirect);

    // Long polling support
    app.get('/:formatType/:/transcode/universal/start', (req, res) => {
        // Save session
        SessionsManager.cacheSessionFromRequest(req);

        // Get sessionId
        const sessionId = SessionsManager.getSessionFromRequest(req);

        // If sessionId is defined
        if (sessionId)
            SessionsManager.cleanSession(sessionId);

        // Redirect
        RoutesTranscode.redirect(req, res);
    });
    app.get('/:formatType/:/transcode/universal/subtitles', RoutesTranscode.redirect);

    // M3U8 support
    app.get('/:formatType/:/transcode/universal/start.m3u8', (req, res) => {
        // Save session
        SessionsManager.cacheSessionFromRequest(req);

        // Get sessionId
        const sessionId = SessionsManager.getSessionFromRequest(req);

        // If sessionId is defined
        if (sessionId)
            SessionsManager.cleanSession(sessionId);

        // Redirect
        RoutesTranscode.redirect(req, res);
    });
    app.get('/:formatType/:/transcode/universal/session/:sessionId/base/index.m3u8', RoutesTranscode.redirect);
    app.get('/:formatType/:/transcode/universal/session/:sessionId/base-x-mc/index.m3u8', RoutesTranscode.redirect);
    app.get('/:formatType/:/transcode/universal/session/:sessionId/:fileType/:partId.ts', RoutesTranscode.redirect);
    app.get('/:formatType/:/transcode/universal/session/:sessionId/:fileType/:partId.vtt', RoutesTranscode.redirect);

    // Control support
    app.get('/:formatType/:/transcode/universal/stop', async (req, res) => {
        // Proxy to plex
        RoutesProxy.plex(req, res);

        // Extract sessionId from request parameter
        const sessionId = SessionsManager.getSessionFromRequest(req);

        // Choose or get the server url
        const serverUrl = await SessionsManager.chooseServer(sessionId, req.headers['x-forwarded-for'] || req.connection.remoteAddress);

        // If a server url is defined, we stop the session
        if (serverUrl)
            fetch(serverUrl + '/api/stop?session=' + sessionId);
    });

    app.get('/:formatType/:/transcode/universal/ping', async (req, res) => {
        // Proxy to Plex
        RoutesProxy.plex(req, res);

        // Extract sessionId from request parameter
        const sessionId = SessionsManager.getSessionFromRequest(req);

        // Choose or get the server url
        const serverUrl = await SessionsManager.chooseServer(sessionId, req.headers['x-forwarded-for'] || req.connection.remoteAddress);

        // If a server url is defined, we ping the session
        if (serverUrl)
            fetch(serverUrl + '/api/ping?session=' + sessionId);
    });

    app.get('/:/timeline', async (req, res) => {
        // Proxy to Plex
        RoutesProxy.plex(req, res);

        // Extract sessionId from request parameter
        const sessionId = SessionsManager.getSessionFromRequest(req);

        // Choose or get the server url
        const serverUrl = await SessionsManager.chooseServer(sessionId, req.headers['x-forwarded-for'] || req.connection.remoteAddress);

        // It's a stop request
        if (req.query.state === 'stopped'/* || (req.query['X-Plex-Session-Identifier'] && SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier']))*/) {
            // If a server url is defined, we stop the session
            if (serverUrl)
                fetch(serverUrl + '/api/stop?session=' + sessionId);
        }
        // it's a ping request
        else if (serverUrl) {
            fetch(serverUrl + '/api/ping?session=' + sessionId);
        }
    });

    // Download
    app.get('/library/parts/:id1/:id2/file.*', RoutesTranscode.redirect);

    // Forward other to Plex
    app.all('*', RoutesProxy.plex);
};
