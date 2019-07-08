import redisClient from 'redis';
import fs from 'fs';
import fetch from 'node-fetch';
import mkdirp from 'mkdirp';
import config from './config';

export const publicUrl = () => {
    return (config.server.public)
};

export const internalUrl = () => {
    return ('http://127.0.0.1:' + config.server.port + '/')
};

export const plexUrl = () => {
    return ('http://' + config.plex.host + ':' + config.plex.port + '/')
};

export const getRedisClient = () => {
    if (config.redis.password === '')
        delete config.redis.password;

    let redis = redisClient.createClient(config.redis);
    redis.on('error', (err) => {
        if (err.errno === 'ECONNREFUSED')
            return console.error('Failed to connect to REDIS, please check your configuration');
        return console.error(err.errno);
    });

    redis.on('connect', () => {
        redis.send_command('config', ['set', 'notify-keyspace-events', 'KEA'])
    });
    return redis;
};

export const time = () => (Math.floor((new Date().getTime()) / 1000));

export const download = (url, filepath) => (new Promise(async (resolve, reject) => {
    const res = await fetch(url);
    const fileStream = fs.createWriteStream(filepath);
    res.body.pipe(fileStream);
    res.body.on("error", (err) => {
        reject(err);
    });
    fileStream.on("finish", () => {
        resolve();
    });
}));

export const mdir = (path) => (new Promise((resolve, reject) => {
    mkdirp(path, (err) => {
        if (err)
            return reject(err);
        return resolve(path);
    })
}));

export const replaceAll = (input, search, replace) => {
    let str = input;
    while (str.indexOf(search) !== -1)
        str = str.replace(search, replace);
    return str
};