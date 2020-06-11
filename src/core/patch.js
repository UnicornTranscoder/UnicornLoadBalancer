import debug from 'debug';



import httpProxy from 'http-proxy';

import config from '../config';


// Debugger
const D = debug('UnicornLoadBalancer');

export const patchDashManifest = (body, transcoderUrl = '/') => {
    const targetUrl = `${transcoderUrl}${transcoderUrl.substr(-1, 1) !== '/' ? '/' : ''}`;
    let patchedBody = body;
console.log(body)

    while (patchedBody.includes('="dash/')) {
        patchedBody = patchedBody.replace('="dash/', `="${targetUrl}dash/`);
    }
console.log(patchedBody);

    return patchedBody;
}

/* Extract IP */
export const getIp = (req) => {
    if (req.get('CF-Connecting-IP'))
        return req.get('CF-Connecting-IP');
    if (req.get('x-forwarded-for'))
        return req.get('x-forwarded-for').split(',')[0];
    return req.connection.remoteAddress
};

export const createProxy = (timeout = 30000, bodyCustomParser = null) => (req, res) => {
    const proxy = httpProxy.createProxyServer();
    proxy.on('error', (err) => {
        res.status(500).send({ error: { code: 'API_ERROR', message: `${apiName} proxy failed, timeout?` } });
        console.error(`${apiName} didn't reply, timeout? (t=${timeoutApi})`, err);
    });

    // Patch proxy body
    if (bodyCustomParser) {
        proxy.on('proxyRes', (proxyRes, req, res) => {
            let body = [];
            proxyRes.on('data', (chunk) => {
                body.push(chunk);
            });
            proxyRes.on('end', async () => {
                body = Buffer.concat(body).toString();
                const patchedBody = await bodyCustomParser(req, body);
                res.end(patchedBody);
            });
        });
    }

    // Proxy the request
    proxy.web(req, res, {
        target: `http://${config.plex.host}:${config.plex.port}`, /* {
            host: config.plex.host,
            port: config.plex.port
        },*/
        //ignorePath: true,
        changeOrigin: true,
        selfHandleResponse: !!bodyCustomParser,
        secure: false,
        followRedirects: true,
        proxyTimeout: timeout,
    });
};
