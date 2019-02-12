import env from 'getenv';

env.disableErrors();

export default {
    version: '2.0.0',
    server: {
        port: env.int('SERVER_PORT', 3001),
        public: env.string('SERVER_PUBLIC', 'http://127.0.0.1:3001/'),
        host: env.string('SERVER_HOST', '127.0.0.1'),
        ssl: env.boolish('SERVER_SSL', false)
    },
    plex: {
        host: env.string('PLEX_HOST', '127.0.0.1'),
        port: env.int('PLEX_PORT', 32400),
        path: {
            usr: env.string('PLEX_PATH_USR', '/usr/lib/plexmediaserver/'),
            sessions: env.string('PLEX_PATH_SESSIONS', '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Cache/Transcode/Sessions/'),
            database: env.string('PLEX_PATH_DATABASE', '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db')
        }
    },
    redis: {
        host: env('REDIS_HOST', undefined),
        port: env.int('REDIS_PORT', 6379),
        password: env.string('REDIS_PASSWORD', ''),
        db: env.int('REDIS_DB', 0)
    },
    scores: {
        timeout: env.int('SCORES_TIMEOUT', 10)
    },
    custom: {
        image: {
            resizer: env.boolish('CUSTOM_IMAGE_RESIZER', true)
        },
        download: {
            forward: env.boolish('CUSTOM_DOWNLOAD_FORWARD', true)
        },
        servers: {
            list: env.array('CUSTOM_SERVERS_LIST', 'string', [])
        }
    }
};
