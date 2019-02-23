import express from 'express';

import config from '../config';
import RoutesAPI from './api';
import RoutesTranscode from './transcode';
import RoutesProxy from './proxy';
import RoutesResize from './resize';

export default (app) => {

    // Note for future:
    // We NEED to 302 the chunk requests because if Plex catchs it with fake transcoder, it stucks

    // UnicornLoadBalancer API
    app.use('/api/sessions', express.static(config.plex.path.sessions));
    app.get('/api/stats', RoutesAPI.stats);
    app.post('/api/ffmpeg', RoutesAPI.ffmpeg);
    app.get('/api/path/:id', RoutesAPI.path);
    app.post('/api/update', RoutesAPI.update);
    app.get('/api/session/:session', RoutesAPI.session);
    app.all('/api/plex/*', RoutesAPI.plex);

    // MPEG Dash support
    app.get('/:formatType/:/transcode/universal/start.mpd', RoutesTranscode.dashStart);
    app.get('/:formatType/:/transcode/universal/dash/:sessionId/:streamId/initial.mp4', RoutesTranscode.redirect);
    app.get('/:formatType/:/transcode/universal/dash/:sessionId/:streamId/:partId.m4s', RoutesTranscode.redirect);

    // Long polling support
    app.get('/:formatType/:/transcode/universal/start', RoutesTranscode.lpStart);
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
    else if (config.custom.image.resizer) {
        app.get('/photo/:/transcode', RoutesResize.resize);
    }

    // Forward other to Plex
    app.all('*', RoutesProxy.plex);
};
