import debug from 'debug';

import { plexUrl } from '../utils';
import { parseArguments, resize } from '../core/images';

// Debugger
const D = debug('UnicornLoadBalancer');

let RoutesResize = {};

RoutesResize.proxy = (req, res) => {
    const params = parseArguments(req.query, plexUrl());
    // TODO
    // Fallback
    RoutesResize.resize(req, res);
}

RoutesResize.resize = (req, res) => {

    // Parse params
    const params = parseArguments(req.query, plexUrl());

    // Check size
    if (!params.width || !params.height || !params.url)
        return (res.status(400).send({ error: { code: 'RESIZE_ERROR', message: 'Invalid parameters, resize request fails' } }));

    // Debug
    D('IMAGE ' + params.url + ' [' + params.format + ']');

    // Mime type
    if (params.format === 'webp')
        res.type(`image/webp`);
    else if (params.format === 'png')
        res.type(`image/png`);
    else
        res.type(`image/jpeg`);

    // Process image
    resize(params).then((stream) => {
        return stream.pipe(res);
    }).catch(err => {
        return (res.status(400).send({ error: { code: 'RESIZE_ERROR', message: 'Invalid parameters, resize request fails' } }));
    })
};

export default RoutesResize;