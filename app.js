// Requires
const express = require('express');
const cors = require('cors');
const ws = require('ws');

// Customs requires
const routes = require('./routes/routes');
const proxy = require('./core/proxy');
const config = require('./config');

// Init Express App
const app = express();

// Allow CORS
app.use(cors());

// Sessions files
app.use('/direct/sessions', express.static(config.plex.transcoderPath));

// Websockets
app.use('/', (req, res, next) => {
    if (!req.headers || req.headers.upgrade === undefined || req.headers.upgrade.toLowerCase() !== 'websocket')
		return (next());
    wss.handleUpgrade(req, req.socket, undefined, (socket) => {
		proxy.ws(req, socket, head);
    })
})
/*
app.on('upgrade', (req, socket, head) => {
	proxy.ws(req, socket, head);
});*/

// Default routes
app.use('/', routes);

// Export app
module.exports = app;
