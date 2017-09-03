// Requires
const express = require('express');
const cors = require('cors');

// Customs requires
const routes = require('./routes/routes');
const proxy = require('./core/proxy');

// Init Express App
const app = express();
app.use(cors());
app.use('/', routes);
app.on('upgrade', (req, socket, head) => {
	proxy.ws(req, socket, head);
});

// Export app
module.exports = app;
