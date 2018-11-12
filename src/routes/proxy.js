import httpProxy from 'http-proxy';
import config from '../config';

let RoutesProxy = {};

RoutesProxy.plex = (req, res) => {
    const proxy = httpProxy.createProxyServer({
        target: {
            host: config.plex.host,
            port: config.plex.port
        }
    }).on('error', () => {
        res.status(400).send({ error: { code: 'PROXY_TIMEOUT', message: 'Plex not respond in time, proxy request fails' } });
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
        res.status(400).send({ error: { code: 'PROXY_TIMEOUT', message: 'Plex not respond in time, proxy request fails' } });
    });
    return (proxy.ws(req, res));
};

export default RoutesProxy;
