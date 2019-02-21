import debug from 'debug';
import httpProxy from 'http-proxy';
import { plexUrl } from '../utils';
import { parseArguments, resize } from '../core/images';
import config from '../config';

// Debugger
const D = debug('UnicornLoadBalancer');

let RoutesResize = {};

/* Forward image request to the image transcode */
RoutesResize.proxy = (req, res) => {
    const params = parseArguments(req.query, plexUrl(), req.get('User-Agent'));
    const path = Object.keys(params).map(e => (`${e}=${encodeURIComponent(params[e])}`)).join('&');
    req.url = config.custom.image.proxy + 'photo/:/transcode?' + path;
    const proxy = httpProxy.createProxyServer({ target: config.custom.image.proxy, changeOrigin: true });
    proxy.web(req, res);
}

/* Custom image transcoder */
RoutesResize.resize = (req, res) => {

    // Parse params
    const params = parseArguments(req.query, plexUrl(), req.get('User-Agent'));

    // Check size
    if (!params.width || !params.height || !params.url)
        return (res.status(400).send({ error: { code: 'RESIZE_ERROR', message: 'Invalid parameters, resize request fails' } }));

    // Debug
    D('IMAGE ' + params.url + ' [' + params.format + ']');

    // Process image
    resize(params).then((stream) => {

        // Mime type
        if (params.format === 'webp')
            res.type(`image/webp`);
        else if (params.format === 'png')
            res.type(`image/png`);
        else
            res.type(`image/jpeg`);

        return stream.pipe(res);
    }).catch(err => {
        return (res.status(400).send({ error: { code: 'RESIZE_ERROR', message: 'Invalid parameters, resize request fails' } }));
    })
};

export default RoutesResize;