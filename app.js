// Requires
const express = require('express');
const cors = require('cors');

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

// Default routes
app.use('/', routes);

// Export app
module.exports = app;
