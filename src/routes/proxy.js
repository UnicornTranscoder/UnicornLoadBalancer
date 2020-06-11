import httpProxy from 'http-proxy';
import config from '../config';

let RoutesProxy = {};

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
