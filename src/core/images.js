import md5 from 'md5';
import { parseUserAgent } from 'detect-browser';

export const parseArguments = (query, basepath = '/', useragent = '') => {
    // Parse url
    let url = query.url || '';
    url = url.replace('http://127.0.0.1/', '/');
    url = url.replace('http://127.0.0.1:32400/', '/');
    url = url.replace(basepath, '/');
    if (query['X-Plex-Token'] && url && url[0] === '/') {
        url += (url.indexOf('?') === -1) ? `?X-Plex-Token=${query['X-Plex-Token']}` : `&X-Plex-Token=${query['X-Plex-Token']}`
    }
    if (url && url[0] === '/')
        url = basepath + url.substring(1);

    // Extract parameters
    let params = {
        ...((query.width) ? { w: parseInt(query.width) } : {}),
        ...((query.height) ? { h: parseInt(query.height) } : {}),
        ...((query.blur) ? { blur: parseInt(query.blur * 2), gam: 4 } : {}),
        ...((query.quality) ? { quality: parseInt(query.quality) } : ((query.blur) ? { quality: 90 } : { quality: 70 })),
        ...((query['X-Plex-Token']) ? { "X-Plex-Token": query['X-Plex-Token'] } : {}),
        url
    };

    // Auto select WebP if user-agent support it
    const browser = parseUserAgent(useragent);
    if (browser && browser.name && browser.name === 'chrome') {
        params = { ...params, output: 'webp' };
    }

    // Generate key
    params.key = md5(`${(query.url || '').split('?')[0]}|${params.w || ''}|${params.h || ''}|${params.blur || ''}|${params.output || ''}|${params.quality || ''}`.toLowerCase())

    // Return params
    return params;
}