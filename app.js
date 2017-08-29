/**
 * Created by Maxime Baconnais on 29/08/2017.
 */

const express = require('express');
const routes = require('./routes/routes');

const app = express();

app.use('/', routes);

module.exports = app;
