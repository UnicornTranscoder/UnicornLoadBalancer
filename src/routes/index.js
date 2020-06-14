import express from 'express';
import debug from 'debug';
import fetch from 'node-fetch';

import config from '../config';
import RoutesAPI from './api';
import { createProxy, patchDashManifest, getIp } from '../core/patch';
import SessionsManager from '../core/sessions';

// Debugger
const D = debug('UnicornLoadBalancer');

export default (app) => {

    const redirectToTranscoder = async (req, res) => {
        const session = SessionsManager.getSessionFromRequest(req);
        const server = await SessionsManager.chooseServer(session, getIp(req));
        if (server) {
            res.redirect(307, server + req.url);
            D('REDIRECT ' + session + ' [' + server + ']');
        } else {
            res.status(500).send({ error: { code: 'SERVER_UNAVAILABLE', message: 'SERVER_UNAVAILABLE' } });
            D('REDIRECT ' + session + ' [UNKNOWN]');
        }
    };



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
        D('START ' + SessionsManager.getSessionFromRequest(req) + ' [DASH]');

        // Save session
        SessionsManager.cacheSessionFromRequest(req);

        // If session id available
        if (sessionId) {
            SessionsManager.cleanSession(sessionId);
        }

        // Select server
        const server = await SessionsManager.chooseServer(sessionId, getIp(req));

        // Todo: Call transcoder using API to ask to start the session
        fetch(`${server}unicorn/dash/${sessionId}/start`)

        return { sessionId, server }
    }, async (_, body, { server }) => {
        // Return patched manifest
        return patchDashManifest(body, server);
    }));

    app.get('/:formatType/:/transcode/universal/dash/:sessionId/:streamId/initial.mp4', (req, res) => (res.status(404).send('Not supported here')));
    app.get('/:formatType/:/transcode/universal/dash/:sessionId/:streamId/:partId.m4s', (req, res) => (res.status(404).send('Not supported here')));

    // Long polling support
    app.get('/:formatType/:/transcode/universal/start', (req, res) => {
        // Save session
        SessionsManager.cacheSessionFromRequest(req);

        // Get sessionId
        const sessionId = SessionsManager.getSessionFromRequest(req);

        // Log
        D('START ' + sessionId + ' [LP]');

        // Redirect
        redirectToTranscoder(req, res);
    });
    app.get('/:formatType/:/transcode/universal/subtitles', redirectToTranscoder); // Should keep 302...

    // M3U8 support
    app.get('/:formatType/:/transcode/universal/start.m3u8', (req, res) => {
        // Proxy to Plex
        RoutesProxy.plex(req, res);

        // Save session
        SessionsManager.cacheSessionFromRequest(req);

        // Get sessionId
        const sessionId = SessionsManager.getSessionFromRequest(req);

        // Log
        D('START ' + sessionId + ' [HLS]');

        // If sessionId is defined
        if (sessionId)
            SessionsManager.cleanSession(sessionId);
    });
    app.get('/:formatType/:/transcode/universal/session/:sessionId/base/index.m3u8', (req, res) => (res.status(404).send('Not supported here')));
    app.get('/:formatType/:/transcode/universal/session/:sessionId/base-x-mc/index.m3u8', (req, res) => (res.status(404).send('Not supported here')));
    app.get('/:formatType/:/transcode/universal/session/:sessionId/:fileType/:partId.ts', (req, res) => (res.status(404).send('Not supported here')));
    app.get('/:formatType/:/transcode/universal/session/:sessionId/:fileType/:partId.vtt', (req, res) => (res.status(404).send('Not supported here')));

    /*
     * Plex "STOP" endpoint
     * This endpoint stop a specific stream, the session id is provided in query args
     */
    app.get('/:formatType/:/transcode/universal/stop', createProxy(10000, async (req) => {
        // Extract sessionId from request parameter
        const sessionId = SessionsManager.getSessionFromRequest(req);

        // Choose or get the server url
        const serverUrl = await SessionsManager.chooseServer(sessionId, getIp(req));

        // If a server url is defined, we stop the session
        if (serverUrl) {
            D('STOP ' + sessionId + ' [' + serverUrl + ']');
            fetch(serverUrl + '/api/stop?session=' + sessionId);
        } else {
            D('STOP ' + sessionId + ' [UNKNOWN]');
        }
    }));

    /*
     * Plex "PING" endpoint
     * This endpoint "ping" a specific stream to keep it alive
     */
    app.get('/:formatType/:/transcode/universal/ping', createProxy(10000, async (req) => {
        // Extract sessionId from request parameter
        const sessionId = SessionsManager.getSessionFromRequest(req);

        // Choose or get the server url
        const serverUrl = await SessionsManager.chooseServer(sessionId, getIp(req));

        // If a server url is defined, we ping the session
        if (serverUrl) {
            D('PING ' + sessionId + ' [' + serverUrl + ']');
            fetch(serverUrl + '/api/ping?session=' + sessionId);
        } else {
            D('PING ' + sessionId + ' [UNKNOWN]');
        }
    }));

    /*
     * Plex "TIMELINE" endpoint
     * This endpoint "ping" a specific stream or stop the current session based on query args
     */
    app.get('/:/timeline', createProxy(10000, async (req) => {
        // Extract sessionId from request parameter
        const sessionId = SessionsManager.getSessionFromRequest(req);

        // Choose or get the server url
        const serverUrl = await SessionsManager.chooseServer(sessionId, getIp(req));

        // It's a stop request
        if (req.query.state === 'stopped') {
            // If a server url is defined, we stop the session
            if (serverUrl) {
                D('STOP ' + sessionId + ' [' + serverUrl + ']');
                fetch(serverUrl + '/api/stop?session=' + sessionId);
            } else {
                D('STOP ' + sessionId + ' [UNKNOWN]');
            }
        }
        // It's a ping request
        else {
            if (serverUrl) {
                D('PING ' + sessionId + ' [' + serverUrl + ']');
                fetch(serverUrl + '/api/ping?session=' + sessionId);
            } else {
                D('PING ' + sessionId + ' [UNKNOWN]');
            }
        }
    }));

    // Download
    if (config.custom.download.forward) {
        app.get('/library/parts/:id1/:id2/file.*', redirectToTranscoder);
    }

    /*
     * Plex "DOWNLOAD" endpoint
     * This endpoint download a specific file, we override it because NodeJS is nore optimized to serve file thant Plex ;)
     */
    if (!config.custom.download.forward) {
        app.get('/library/parts/:id1/:id2/file.*', (req, res) => {
            D('DOWNLOAD ' + req.params.id1 + ' [LB]');
            Database.getPartFromId(req.params.id1).then((data) => {
                res.sendFile(data.file, {}, (err) => {
                    if (err && err.code !== 'ECONNABORTED')
                        D('DOWNLOAD FAILED ' + req.params.id1 + ' [LB]');
                })
            }).catch((err) => {
                res.status(400).send({ error: { code: 'NOT_FOUND', message: 'File not available' } });
            })
        });
    }

    /*
     * Plex "PHOTO" endpoint
     * This endpoint returns a compressed image, we add a converter to support images.weserv.nl API ;)
     */
    if (config.custom.image.proxy) {
        app.get('/photo/:/transcode', (req, res) => {
            const params = parseArguments(req.query, publicUrl(), req.get('User-Agent'));
            const args = Object.keys(params).map(e => (`${e}=${encodeURIComponent(params[e])}`)).join('&');
            const url = `${config.custom.image.proxy}?${args}`;
            fetch(url).then((fet) => {
                const headers = fet.headers.raw();
                Object.keys(headers).forEach((h) => {
                    res.set(h, headers[h][0]);
                })
                return fet.buffer();
            }).then((buf) => {
                res.send(buf);
            }).catch(err => {
                console.error(err);
                return res.status(400).send({ error: { code: 'RESIZE_ERROR', message: 'Invalid parameters, resize request fails' } });
            });
        }
        );
    }

    /*
     * Plex "OTHER" endpoint
     * Forward all the other request to Plex
     */
    app.all('*', createProxy(10000));
};
