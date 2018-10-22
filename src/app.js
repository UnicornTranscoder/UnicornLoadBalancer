import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

import config from './config';
import Router from './routes';
import { internalUrl } from './utils';

import debug from 'debug';

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
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status >= 400 && err.status < 500 && err.message.indexOf('JSON'))
        res.status(400).send({ error: { code: 'INVALID_BODY', message: 'Syntax error in the JSON body' } });
});

// Init routes
D('Initializing API routes...');

// Routes
Router(app);

// Bind and start
app.listen(config.server.port)
D('Launched on ' + internalUrl());
