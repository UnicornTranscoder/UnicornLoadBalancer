// Requires
const express = require('express');
const cors = require('cors');

// Customs requires
const routes = require('./routes/routes');
const proxy = require('./core/proxy');
const config = require('./config');
const stats = require('./core/stats');

// Init Express App
const app = express();

// Allow CORS
app.use(cors());

// Sessions files
app.use('/api/sessions', express.static(config.plex.sessions));

// Default routes
app.use('/', routes);

// Export app
module.exports = app;


