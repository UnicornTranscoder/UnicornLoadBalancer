import httpProxy from 'http-proxy';
import config from '../config';

let RoutesProxy = {};

RoutesProxy.plex = (req, res) => {
    const proxy = httpProxy.createProxyServer({
        target: {
            host: config.plex.host,
            port: config.plex.port
        },
        proxyTimeout: 60000,
        timeout: 60000,
    }).on('error', (err) => {
        // On some Plex request from FFmpeg, Plex don't create a valid request
        if (err.code === 'HPE_UNEXPECTED_CONTENT_LENGTH')
            return (res.status(200).send());

        // Other error
        return (res.status(400).send({ error: { code: 'PROXY_TIMEOUT', message: 'Plex not respond in time, proxy request fails' } }));
    });
    return (proxy.web(req, res));
};

RoutesProxy.ws = (req, res) => {
    const proxy = httpProxy.createProxyServer({
        target: {
            host: config.plex.host,
            port: config.plex.port
        }
    }).on('error', () => {
        // Fail silently
    });
    return (proxy.ws(req, res));
};

export default RoutesProxy;
