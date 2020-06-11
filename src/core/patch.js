import config from '../config';

export const patchDashManifest = (body, transcoderUrl = '/') => {
    const targetUrl = `${transcoderUrl}${transcoderUrl !== '/' ? '/' : ''}`;
    let patchedBody = body;
    while (patchedBody.includes('="dash/')) {
        patchedBody = patchedBody.replace('="dash/', `="${targetUrl}dash/`);
    }
    return patchedBody;
}

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
            proxyRes.on('end', () => {
                body = Buffer.concat(body).toString();
                res.end(bodyCustomParser(req, body));
            });
        });
    }

    // Proxy the request
    proxy.web(req, res, {
        target: {
            host: config.plex.host,
            port: config.plex.port
        },
        ignorePath: true,
        changeOrigin: true,
        secure: false,
        followRedirects: true,
        proxyTimeout: timeout,
    });
};
