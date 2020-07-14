import debug from 'debug';
import httpProxy from 'http-proxy';
import config from '../config';

// Debugger
const D = debug('UnicornLoadBalancer');

export const patchDashManifest = (body, transcoderUrl = '/') => {
    const targetUrl = `${transcoderUrl || ''}${(transcoderUrl || '').substr(-1, 1) !== '/' ? '/' : ''}`;
    let patchedBody = body;
    // console.log(body)

    while (patchedBody.includes('="dash/')) {
        patchedBody = patchedBody.replace('="dash/', `="${targetUrl}unicorn/dash/`);
    }
    //console.log(patchedBody);

    return patchedBody;
}

export const patchHLSManifest = (body, sessionId, transcoderUrl = '/') => {
    const targetUrl = `${transcoderUrl || ''}${(transcoderUrl || '').substr(-1, 1) !== '/' ? '/' : ''}`;
    let patchedBody = body.split('\n');

    for (let i = 0; i < patchedBody.length; i++) {
        if (patchedBody[i].endsWith('.ts')) {
            patchedBody[i] = `${targetUrl}unicorn/hls/${sessionId}/${patchedBody[i]}`;
        } else if (patchedBody[i].endsWith('.vtt')) {
            patchedBody[i] = `${targetUrl}unicorn/hls/${sessionId}/${patchedBody[i]}`;
        } else if (patchedBody[i] === '#EXT-X-MAP:URI="header"') {
            patchedBody[i] = `#EXT-X-MAP:URI="${targetUrl}unicorn/hls/${sessionId}/header"`;
        }
    }
    return patchedBody.join('\n');
}

/* Extract IP */
export const getIp = (req) => {
    if (req.get('CF-Connecting-IP'))
        return req.get('CF-Connecting-IP');
    if (req.get('x-forwarded-for'))
        return req.get('x-forwarded-for').split(',')[0];
    return req.connection.remoteAddress
};

export const createWebsocketProxy = () => async (req, res) => {
    const proxy = httpProxy.createProxyServer();
    proxy.on('error', () => {
        // Fail silently
    });
    return (proxy.ws(req, res));
}

export const createProxy = (timeout = 30000, initialParser = null, bodyCustomParser = null, customResponse = null) => async (req, res) => {
    const initialData = initialParser ? await initialParser(req) : {};

    const proxy = httpProxy.createProxyServer();
    proxy.on('error', (err) => {
        // On some Plex request from FFmpeg, Plex don't create a valid request
        if (err.code === 'HPE_UNEXPECTED_CONTENT_LENGTH')
            return (res.status(200).send());

        // Other error
        return (res.status(400).send({ error: { code: 'PROXY_TIMEOUT', message: 'Plex not respond in time, proxy request fails' } }));
    });

    // Patch proxy body
    if (bodyCustomParser) {
        proxy.on('proxyReq', (proxyReq, req, res, options) => {
            proxyReq.removeHeader('Accept-Encoding');
        });
        proxy.on('proxyRes', (proxyRes, req, res) => {
            let body = [];
            proxyRes.on('data', (chunk) => {
                body.push(chunk);
            });
            proxyRes.on('end', async () => {
                body = Buffer.concat(body).toString();
                D(body)
                const patchedBody = await bodyCustomParser(req, body, initialData);
                res.end(patchedBody);
            });
        });
    } else if (customResponse) {
        proxy.on('proxyRes', (proxyRes, req, res) => {
            customResponse(req, res, initialData);
        });
    }

    // Proxy the request
    proxy.web(req, res, {
        target: {
            host: config.plex.host,
            port: config.plex.port
        },
        selfHandleResponse: !!bodyCustomParser,
        secure: false,
        followRedirects: false,
        proxyTimeout: timeout,
    });
};
