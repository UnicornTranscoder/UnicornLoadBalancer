import debug from 'debug';
import { parseUserAgent } from 'detect-browser';

import { plexUrl } from '../utils';
import optimizeImage from '../core/images';

// Debugger
const D = debug('UnicornLoadBalancer');

let RoutesResize = {};

RoutesResize.resize = (req, res) => {

    // Parse url
    let url = req.query.url || false;
    if (url && url[0] === '/')
        url = plexUrl() + url.substring(1);

    // Extract parameters
    const params = {
        ...((req.query.width) ? { width: parseInt(req.query.width) } : {}),
        ...((req.query.height) ? { height: parseInt(req.query.height) } : {}),
        ...((req.query.background) ? { background: req.query.background } : {}),
        ...((req.query.opacity) ? { opacity: parseInt(req.query.opacity) } : {}),
        ...((req.query.minSize) ? { minSize: parseInt(req.query.minSize) } : {}),
        ...((req.query.blur) ? { blur: parseInt(req.query.blur) } : {}),
        ...((req.query.format && (req.query.format === 'webp' || req.query.format === 'png')) ? { format: req.query.format } : { format: 'jpg' }),
        ...((req.query.upscale) ? { upscale: parseInt(req.query.upscale) } : {}),
    };

    // Check size
    if (!params.width || !params.height || !url)
        return (res.status(400).send({ error: { code: 'RESIZE_ERROR', message: 'Invalid parameters, resize request fails' } }));

    // Auto select WebP if user-agent support it
    const browser = parseUserAgent(req.get('User-Agent'));
    const needAlpha = params.format === 'png';
    if (browser.name === 'chrome') {
        params.format = 'webp';
    }

    // Debug
    D('IMAGE ' + url + ' [' + params.format + ']');

    // Mime type
    if (params.format === 'webp')
        res.type(`image/webp`);
    else if (params.format === 'png')
        res.type(`image/png`);
    else
        res.type(`image/jpeg`);

    // Process image
    optimizeImage(url, params, needAlpha).then((stream) => {
        return stream.pipe(res);
    }).catch(err => {
        return (res.status(400).send({ error: { code: 'RESIZE_ERROR', message: 'Invalid parameters, resize request fails' } }));
    })
};

export default RoutesResize;