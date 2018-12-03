import sharp from 'sharp';
import fetch from 'node-fetch';
import { PassThrough } from 'stream';
import { plexUrl } from '../utils';

let RoutesResize = {};

const resizeFromUrl = (url, width = false, height = false, minSize = 0, format = 'jpeg') => {
    let pass = new PassThrough();

    fetch(url).then(res => {
        res.body.pipe(pass);
    });

    let transform = sharp();


    if (width || height) {
        transform = transform.resize(((minSize > 0) ? width : undefined), ((minSize <= 0) ? height : undefined));
    }

    if (format) {
        transform = transform.toFormat(sharp.format.webp); // jpeg | webp | png
    }

    return pass.pipe(transform);
}

RoutesResize.resize = (req, res) => {
    let url = req.query.url || false;
    if (url && url[0] == '/')
        url = plexUrl() + url;

    const params = {
        width: parseInt(req.query.width) || false,
        height: parseInt(req.query.height) || false,
        minSize: parseInt(req.query.minSize) || 0,
        url
    };

    if (!params.width || !params.height || !params.url)
        return (res.status(400).send({ error: { code: 'RESIZE_ERROR', message: 'Invalid parameters, resize request fails' } }));

    res.type(`image/webp`);
    resizeFromUrl(params.url, params.width, params.height, params.minSize).pipe(res)
};

export default RoutesResize;