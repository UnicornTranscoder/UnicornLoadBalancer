// Requires
const http = require('http');
const express = require('express');
const cors = require('cors');
const ws = require('ws');

// Customs requires
const routes = require('./routes/routes');
const proxy = require('./core/proxy');
const config = require('./config');

// Init Express App
const app = express();
const server = http.createServer(app);

// Allow CORS
app.use(cors());

// Sessions files
app.use('/direct/sessions', express.static(config.plex.transcoderPath));

// Websockets
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

// Default routes
app.use('/', routes);

// Export app
module.exports = app;
