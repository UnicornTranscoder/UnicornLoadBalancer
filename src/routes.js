import express from 'express';

import config from './config';
import RoutesAPI from './routes/api';

export default (app) => {

    // UnicornLoadBalancer API
    app.use('/api/sessions', express.static(config.plex.path.sessions));
    app.get('/api/stats', RoutesAPI.stats);
    app.post('/api/ffmpeg', RoutesAPI.ffmpeg);
    app.get('/api/path/:id', RoutesAPI.path);
    app.post('/api/update', RoutesAPI.update);
    app.all('/api/plex/*', RoutesAPI.plex);

    // MPEG Dash support
    app.get('/video/:/transcode/universal/start.mpd'); // 302 => /transcode/dash/start.mpd?uid={UNICORNID} // Plex called by Transcoder

    // Long polling support
    app.get('/video/:/transcode/universal/start'); // 302 => /transcode/polling/start?uid={UNICORNID}&offset=X // Plex called by Transcoder
    app.get('/video/:/transcode/universal/subtitles'); // 302 => /transcode/polling/subtitles?uid={UNICORNID} // Don't call Plex

    // M3U8 support
    app.get('/video/:/transcode/universal/start.m3u8'); // 302 => /transcode/m3u8/start.m3u8?uid={UNICORNID} // Plex called by Transcoder
    app.get('/video/:/transcode/universal/session/:sessionId/base/index.m3u8'); // 302 => /transcode/m3u8/index.m3u8?uid={UNICORNID}  // Don't call Plex
    app.get('/video/:/transcode/universal/session/:sessionId/base-x-mc/index.m3u8'); // 302 => /transcode/m3u8/index-mc.m3u8?uid={UNICORNID}  // Don't call Plex

    // Control support
    app.get('/video/:/transcode/universal/stop'); // Proxy => /control/stop?uid={UNICORNID} + Call Plex
    app.get('/video/:/transcode/universal/ping'); // Proxy => /control/ping?uid={UNICORNID} + Call Plex
    app.get('/:/timeline'); // Proxy => /control/ping?uid={UNICORNID} + Call Plex

    // Download
    app.get('/library/parts/:id1/:id2/file.*'); // 302 => /download?uid={UNICORNID}

    // Forward other to Plex
    app.all('*');
};