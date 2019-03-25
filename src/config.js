import env from 'getenv';

env.disableErrors();

export default {
    version: '2.0.0',
    server: {
        port: env.int('SERVER_PORT', 3001),
        public: env.string('SERVER_PUBLIC', 'http://127.0.0.1:3001/'),
        host: env.string('SERVER_HOST', '127.0.0.1')
    },
    plex: {
        host: env.string('PLEX_HOST', '127.0.0.1'),
        port: env.int('PLEX_PORT', 32400),
        path: {
            usr: env.string('PLEX_PATH_USR', '/usr/lib/plexmediaserver/'),
            sessions: env.string('PLEX_PATH_SESSIONS', '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Cache/Transcode/Sessions/')
        }
    },
    database: {
        mode: env.string('DATABASE_MODE', 'sqlite'),
        sqlite: {
            path: env.string('DATABASE_SQLITE_PATH', '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db')
        },
        postgresql: {
            host: env.string('DATABASE_POSTGRESQL_HOST', ''),
            database: env.string('DATABASE_POSTGRESQL_DATABASE', ''),
            user: env.string('DATABASE_POSTGRESQL_USER', ''),
            password: env.string('DATABASE_POSTGRESQL_PASSWORD', ''),
            port: env.int('DATABASE_POSTGRESQL_PORT', 5432)
        }
    },
    redis: {
        host: env('REDIS_HOST', undefined),
        port: env.int('REDIS_PORT', 6379),
        password: env.string('REDIS_PASSWORD', ''),
        db: env.int('REDIS_DB', 0)
    },
    custom: {
        scores: {
            timeout: env.int('CUSTOM_SCORES_TIMEOUT', 10)
        },
        image: {
            resizer: env.boolish('CUSTOM_IMAGE_RESIZER', false),
            proxy: env.string('CUSTOM_IMAGE_PROXY', '')
        },
        medias: {
            replicated: env.boolish('CUSTOM_MEDIAS_REPLICATED', false)
        },
        resolvers: {
            // Resolvers configurations here
        },
        servers: {
            list: env.array('CUSTOM_SERVERS_LIST', 'string', [])
        }
    }
};
