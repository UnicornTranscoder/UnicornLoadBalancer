import httpProxy from 'http-proxy';
import sqlite3 from 'sqlite3';

import config from '../config';
import SessionsManager from '../core/sessions';
import ServersManager from '../core/servers';

let RoutesAPI = {};

// Returns all the stats of all the transcoders
RoutesAPI.stats = (req, res) => {
    res.send(ServersManager.stats());
};

// Save the stats of a server
RoutesAPI.update = (req, res) => {
    res.send(ServersManager.update(req.body));
};

// Save the FFMPEG arguments
// Body: {args: [], env: []}
RoutesAPI.ffmpeg = (req, res) => {
    if (!req.body || !req.body.args || !req.body.env)
        res.status(400).send({ error: { code: 'INVALID_ARGUMENTS', message: 'Invalid UnicornFFMPEG parameters' } });
    res.send(SessionsManager.storeFFmpegParameters = (req.body.args, req.body.env));
};

// Resolve path from file id
RoutesAPI.path = (req, res) => {
    try {
        const db = new sqlite3.verbose().Database(config.plex.database);
        db.get("SELECT * FROM media_parts WHERE id=? LIMIT 0, 1", req.params.id, (err, row) => {
            if (row && row.file)
                res.send(JSON.stringify(row));
            else
                res.status(400).send({ error: { code: 'FILE_NOT_FOUND', message: 'File not found in Plex Database' } });
            db.close();
        });
    }
    catch (err) {
        res.status(400).send({ error: { code: 'FILE_NOT_FOUND', message: 'File not found in Plex Database' } });
    }
};

// Proxy to Plex
RoutesAPI.plex = (req, res) => {
    const proxy = httpProxy.createProxyServer({
        target: {
            host: config.plex.host,
            port: config.plex.port
        }
    }).on('error', (err, req, res) => {
        res.status(400).send({ error: { code: 'PROXY_TIMEOUT', message: 'Plex not respond in time, proxy request fails' } });
    });
    req.url = req.url.slice('/api/plex'.length);
    return (proxy.web(req, res));
};

// Export all our API routes
export default RoutesAPI;