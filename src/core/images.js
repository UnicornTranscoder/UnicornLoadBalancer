import fetch from 'node-fetch';
import sharp from 'sharp';
import color from 'color';

export default (link, parameters, needAlpha = false) => {
    return new Promise(async (resolve, reject) => {
        try {
            const params = {

                // Width of the image (px value)
                width: false,

                // Height of the image (px value)
                height: false,

                // Background color
                background: false,

                // Background opacity
                opacity: false,

                // Resize constraint (0:height / 1:width)
                minSize: 0,

                // Blur on picture (between 0 and 10000)
                blur: 0,

                // Output format
                format: false, // png / jpg / webp

                // Force upscale
                upscale: false,

                // User parameters
                ...parameters
            }

            if (!params.width || !params.height)
                return reject('Size not provided');

            // Get image content
            const body = await fetch(link).then(res => res.buffer());

            // Load body
            let s = sharp(body);

            // Resize parameters
            const opt = {
                ...((params.upscale) ? { withoutEnlargement: !!params.upscale } : {})
            }

            // Resize based on width
            if (params.minSize === 1)
                s.resize(params.width, null, opt);
            else
                s.resize(null, params.height, opt);

            // Background & opacity support
            if (params.background && params.opacity) {
                const buff = await s.png().toBuffer();
                s = sharp(buff);
                const meta = await s.metadata();
                const bgd = await sharp({
                    create: {
                        width: meta.width,
                        height: meta.height,
                        channels: 4,
                        background: {
                            r: color(`#${params.background}`).r,
                            g: color(`#${params.background}`).g,
                            b: color(`#${params.background}`).b,
                            alpha: ((100 - params.opacity) / 100)
                        }
                    }
                }).png().toBuffer();
                s.overlayWith(bgd);
            }

            // Blur
            if (params.blur > 0 && params.blur <= 1000)
                s.blur(params.blur * 1.25).gamma(2);

            // Output format
            if (params.format === 'jpg')
                s.jpeg({
                    quality: 70
                })
            else if (params.format === 'png')
                s.png({
                    quality: 70,
                    progressive: true,
                    compressionLevel: 9
                })
            else if (params.format === 'webp')
                s.webp({
                    quality: 70,
                    ...((needAlpha) ? {} : { alphaQuality: 0 })
                })

            // Return stream
            resolve(s);
        }
        catch (err) {
            reject(err);
        }
    });
}