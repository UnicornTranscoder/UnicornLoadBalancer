import express from 'express';
import debug from 'debug';
import fetch from 'node-fetch';

import config from './config';
import { createProxy, patchDashManifest, getIp, patchHLSManifest } from './core/patch';
import SessionsManager from './core/sessions';
import Database from './database';

// Debugger
const D = debug('UnicornLoadBalancer');

export default (app) => {

    /*
     * Unicorn endpoint to serve static subtitles and fonts
     */
    app.use('/unicorn/static', express.static(config.plex.path.sessions));


    /*
    * Unicorn endpoint to get stats about current tasks
    */
    app.get('/unicorn/stats', (req, res) => {
        res.send(ServersManager.list());
    });


    // Catch the FFMPEG arguments
    // Body: {args: [], env: []}
    app.post('/api/ffmpeg', async (req, res) => {
        if (!req.body || !req.body.arg || !req.body.env)
            return (res.status(400).send({ error: { code: 'INVALID_ARGUMENTS', message: 'Invalid UnicornFFMPEG parameters' } }));

        // Detect if we are in optimizer mode
        if (req.body.arg.filter(e => (e === '-segment_list' || e === '-manifest_name')).length === 0) {
            const parsedArgs = await SessionsManager.parseFFmpegParameters(req.body.arg, req.body.env, true);
            SessionsManager.ffmpegSetCache(parsedArgs.id, false);
            D('FFMPEG ' + parsedArgs.session + ' [OPTIMIZE]');
            SessionsManager.saveSession(parsedArgs);
            SessionsManager.optimizerInit(parsedArgs);
            return (res.send(parsedArgs));
        }
        // Streaming mode
        else {
            const parsedArgs = await SessionsManager.parseFFmpegParameters(req.body.arg, req.body.env);
            SessionsManager.ffmpegSetCache(parsedArgs.id, false);
            D('FFMPEG ' + parsedArgs.session + ' [STREAMING]');
            SessionsManager.saveSession(parsedArgs)
            return (res.send(parsedArgs));
        }
    });

    // Get ffmpeg status
    app.get('/api/ffmpeg/:id', async (req, res) => {
        if (!req.params.id)
            return (res.status(400).send({ error: { code: 'INVALID_ARGUMENTS', message: 'Invalid parameters' } }));
        D('FFMPEG ' + req.params.id + ' [PING]');
        return (res.send({
            id: req.params.id,
            status: SessionsManager.ffmpegGetCache(req.params.id)
        }));
    });

    // Resolve path from file id
    app.get('/api/path/:id', (req, res) => {
        Database.getPartFromId(req.params.id).then((data) => {
            res.send(JSON.stringify(data));
        }).catch((err) => {
            res.status(400).send({ error: { code: 'FILE_NOT_FOUND', message: 'File not found in Plex Database' } });
        })
    });

    // Save the stats of a server
    app.post('/api/update', (req, res) => {
        res.send(ServersManager.update(req.body));
    });

    // Returns session
    app.get('/api/session/:session', (req, res) => {
        SessionStore.get(req.params.session).then((data) => {
            res.send(data);
        }).catch(() => {
            res.status(400).send({ error: { code: 'SESSION_TIMEOUT', message: 'The session wasn\'t launched in time, request fails' } });
        })
    });

    // Optimizer finish
    app.patch('/unicorn/optimize/:sessionId/finished', (req, res) => {
        SessionStore.get(req.params.sessionId).then((data) => {
            D('Session ok' + JSON.stringify(data));
            SessionsManager.optimizerDownload(data).then((parsedData) => {
                D('File downloaded localy ' + JSON.stringify(parsedData))
                SessionsManager.optimizerDelete(parsedData);
            });
            res.send(data);
        }).catch(() => {
            res.status(400).send({ error: { code: 'SESSION_TIMEOUT', message: 'Invalid session' } });
        })
    });

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

    /*
     * Plex "DASH START" endpoint
     * This endpoint starts a DASH transcode
     */
    app.get('/:formatType/:/transcode/universal/start.mpd', createProxy(30000, async (req) => {
        let sessionId = false;

        // If we have a cached X-Plex-Session-Identifier, we use it
        if (req.query['X-Plex-Session-Identifier'] && SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier'])) {
            sessionId = SessionsManager.getCacheSession(req.query['X-Plex-Session-Identifier']);
        } else {
            sessionId = SessionsManager.getSessionFromRequest(req);
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
        fetch(`${server}/unicorn/dash/${sessionId}/start`).catch(() => false);

        return { sessionId, server }
    }, async (_, body, { server }) => {
        // Return patched manifest
        return patchDashManifest(body, server);
    }));

    /*
     * Plex "DASH SERVE" endpoints
     * These endpoints serves .mp4 and .m4s files for DASH streams, we have to catch them, because Plex crash if it receive these calls
     */
    app.get('/:formatType/:/transcode/universal/dash/:sessionId/:streamId/initial.mp4', (req, res) => (res.status(404).send('Not supported here')));
    app.get('/:formatType/:/transcode/universal/dash/:sessionId/:streamId/:partId.m4s', (req, res) => (res.status(404).send('Not supported here')));

    /*
     * Plex "POLLING START" endpoint
     * This endpoint starts a polling transcode
     */
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

    /*
     * Plex "POLLING SUBTITLES" endpoint
     * This endpoint get subtitles using long-polling
     */
    app.get('/:formatType/:/transcode/universal/subtitles', redirectToTranscoder); // Should keep 302 / Proxy...

    /*
     * Plex "HLS START" endpoint
     * This endpoint starts a HLS transcode
     */
    app.get('/:formatType/:/transcode/universal/start.m3u8', createProxy(30000, async (req) => {
        let sessionId = SessionsManager.getSessionFromRequest(req);

        // Log
        D('START ' + sessionId + ' [HLS]');

        // Save session
        SessionsManager.cacheSessionFromRequest(req);

        // If session id available
        if (sessionId) {
            SessionsManager.cleanSession(sessionId);
        }

        // Select server
        const server = await SessionsManager.chooseServer(sessionId, getIp(req));

        // Call transcoder using API to ask to start the session
        fetch(`${server}/unicorn/hls/${sessionId}/start`).catch(() => false);

        return { sessionId, server }
    }, async (_, body, { sessionId, server }) => {
        // Return patched manifest
        return patchHLSManifest(body, sessionId, server);
    }));


    const patchHLS = createProxy(30000, async (req) => {
        let sessionId = SessionsManager.getSessionFromRequest(req);

        // If session id available
        if (sessionId) {
            SessionsManager.cleanSession(sessionId);
        }

        // Select server
        const server = await SessionsManager.chooseServer(sessionId, getIp(req));
        return { sessionId, server }
    }, async (_, body, { sessionId, server }) => {
        // Return patched manifest
        return patchHLSManifest(body, sessionId, server);
    });

    /*
     * Plex "HLS PLAYLIST" endpoints
     * These endpoints serves .m3u8 files, we patch them to serve chunks from transcoders
     */
    app.get('/:formatType/:/transcode/universal/session/:sessionId/base/index.m3u8', patchHLS);
    app.get('/:formatType/:/transcode/universal/session/:sessionId/base-x-mc/index.m3u8', patchHLS);
    app.get('/:formatType/:/transcode/universal/session/:sessionId/vtt-base/index.m3u8', patchHLS);

    /*
     * Plex "HLS SERVE" endpoints
     * These endpoints serves .ts and .vtt files for HLS streams, we have to catch them, because Plex crash if it receive these calls
     */
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
            fetch(serverUrl + '/unicorn/api/' + sessionId + '/stop');
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
            fetch(serverUrl + '/unicorn/api/' + sessionId + '/ping');
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

        // If a server url is defined, we ping the transcoder
        if (serverUrl) {
            if (req.query.state === 'stopped') {
                // Stop request
                D('STOP ' + sessionId + ' [' + serverUrl + ']');
                fetch(serverUrl + '/unicorn/api/' + sessionId + '/stop');
            } else {
                // Ping request
                D('PING ' + sessionId + ' [' + serverUrl + ']');
                fetch(serverUrl + '/unicorn/api/' + sessionId + '/ping');
            }
        }
        else {
            D('PING ' + sessionId + ' [UNKNOWN]');
        }
    }));

    /*
     * Plex "DOWNLOAD" endpoint
     * This endpoint download a specific file, we override it because NodeJS is nore optimized to serve file thant Plex ;)
     */
    if (!config.custom.download.forward) {
        app.get('/library/parts/:id1/:id2/file.*', (req, res) => {
            D('DOWNLOAD ' + req.params.id1 + ' [LB]');
            Database.getPartFromId(req.params.id1).then((data) => {
                res.sendFile(data.file, {}, (err) => {
                    if (err && err.code !== 'ECONNABORTED') {
                        D('DOWNLOAD FAILED ' + req.params.id1 + ' [LB]');
                    }
                })
            }).catch(() => {
                res.status(400).send({ error: { code: 'NOT_FOUND', message: 'File not available' } });
            })
        });
    } else {
        app.get('/library/parts/:id1/:id2/file.*', async (req, res) => {
            const session = SessionsManager.getSessionFromRequest(req);
            const server = await SessionsManager.chooseServer(session, getIp(req));
            if (server) {
                const url = `${server}/unicorn/download/${req.params.id1}/file.${req.params[0]}`;
                res.redirect(307, url);
                D('REDIRECT ' + session + ' [' + server + ']');
            } else {
                res.status(500).send({ error: { code: 'SERVER_UNAVAILABLE', message: 'SERVER_UNAVAILABLE' } });
                D('REDIRECT ' + session + ' [UNKNOWN]');
            }
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
