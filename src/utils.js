import redisClient from 'redis';

import config from './config';

export const publicUrl = () => {
    return ('http' + ((config.server.ssl) ? 's' : '') + '://' + config.server.host + (([80, 443].indexOf(config.server.port) === -1) ? ':' + config.server.port : '') + '/')
}

export const internalUrl = () => {
    return ('http' + ((config.server.ssl) ? 's' : '') + '://' + config.server.host + ':' + config.server.port + '/')
}

export const plexUrl = () => {
    return ('http://' + config.plex.host + ':' + config.plex.port + '/')
}

export const redis = redisClient.createClient(config.redis);
redis.on('error', (err) => {
    if (err.errno === 'ECONNREFUSED')
        return console.error('Failed to connect to REDIS, please check your configuration');
    return console.error(err.errno);
});
