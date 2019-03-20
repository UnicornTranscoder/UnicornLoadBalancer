import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import debug from 'debug';

import config from './config';
import Router from './routes';
import Proxy from './routes/proxy';
import { internalUrl } from './utils';
import ServersManager from './core/servers';
import Resolver from './resolver';

// Debugger
const D = debug('UnicornLoadBalancer');

// Welcome
D('Version: ' + config.version)

// Init Express
const app = express();

// CORS
app.use(cors());

// Body parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use((err, _, res, next) => {
    if (err instanceof SyntaxError && err.status >= 400 && err.status < 500 && err.message.indexOf('JSON'))
        return (res.status(400).send({ error: { code: 'INVALID_BODY', message: 'Syntax error in the JSON body' } }));
    next();
});

// Init routes
D('Initializing API routes...');

// Routes
Router(app);

// Load servers available in configuration
((Array.isArray(config.custom.servers.list)) ? config.custom.servers.list : []).map(e => ({
    name: e,
    url: ((e.substr(-1) === '/') ? e.substr(0, e.length - 1) : e),
    sessions: [],
    settings: {
        maxSessions: 0,
        maxDownloads: 0,
        maxTranscodes: 0
    }
})).forEach(e => {
    ServersManager.update(e);
});

// Init resolvers
Resolver.init();

// Create HTTP server
const httpServer = app.listen(config.server.port);

// Forward websockets
httpServer.on('upgrade', (req, res) => {
    Proxy.ws(req, res);
});

// Debug
D('Launched on ' + internalUrl());
