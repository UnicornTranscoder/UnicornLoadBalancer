import debug from 'debug';
import fetch from 'node-fetch';
import { publicUrl } from '../utils';
import { parseArguments } from '../core/images';
import config from '../config';

// Debugger
const D = debug('UnicornLoadBalancer');

let RoutesResize = {};

/* Forward image request to the image transcode */
RoutesResize.proxy = (req, res) => {
    const params = parseArguments(req.query, publicUrl(), req.get('User-Agent'));
    const args = Object.keys(params).map(e => (`${e}=${encodeURIComponent(params[e])}`)).join('&');
    const url = `${config.custom.image.proxy}?${args}`;
    fetch(url).then((fet) => {
        const headers = fet.headers.raw();
        Object.keys(headers).forEach((h) => {
            res.set(h, headers[h][0]);
        })
        return fet.buffer();
    }).then((buf) => {
        res.send(buf);
    }).catch(err => {
        console.err(err);
        return res.status(400).send({ error: { code: 'RESIZE_ERROR', message: 'Invalid parameters, resize request fails' } });
    });
}

export default RoutesResize;