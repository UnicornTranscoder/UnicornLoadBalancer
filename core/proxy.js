/**
 * Created by Maxime Baconnais on 29/08/2017.
 */

const httpProxy = require('http-proxy');
const config = require('../config');

let proxy = httpProxy.createProxyServer({
    target: config.general.plex_url
});

module.exports = function (req, res) {
    proxy.web(req, res)
};