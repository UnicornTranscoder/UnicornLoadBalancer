import {getRedisClient} from '../utils';
import config from "../config";

class RedisSessionStore {
    constructor() {
        this.redis = getRedisClient();
        this.redisSubscriber = this.redis.duplicate();
    }

    _parseSession(session) {
        return new Promise((resolve, reject) => {
            try {
                resolve(JSON.parse(session))
            } catch(err) {
                reject(err)
            }
        })
    }

    /**
     * Get a session, or wait for it for 10s
     * @param sessionId
     * @returns {Promise<session>}
     */
    get(sessionId) {
        return new Promise((resolve, reject) => {
            this.redis.get(sessionId, (err, session) => {
                if (err)
                    return reject(err);
                if (session != null)
                    return resolve(this._parseSession(session));

                let redisSubKey = "__keyspace@" + config.redis.db  + "__:" + sessionId;

                let timeout = setTimeout(() => {
                    this.redisSubscriber.unsubscribe(redisSubKey);
                    reject('timeout');
                }, 20000);

                this.redisSubscriber.on("message", (eventKey, action) => {
                    if (action !== 'set' || eventKey !== redisSubKey)
                        return;

                    clearTimeout(timeout);
                    this.redisSubscriber.unsubscribe(redisSubKey);
                    this.redis.get(sessionId, (err, session) => {
                        if (err)
                            return reject(err);
                        return resolve(this._parseSession(session));
                    })
                });
                this.redisSubscriber.subscribe(redisSubKey)
            })
        })
    }

    /**
     * Store a value in the store and trigger the pending gets
     * @param sessionId
     * @param value
     * @returns {Promise<result>}
     */
    set(sessionId, value) {
        return new Promise((resolve, reject) => {
            this.redis.set(sessionId, JSON.stringify(value), (err) => {
                if (err)
                    return reject(err);
                resolve('OK');
            })
        })
    }

    /**
     * Delete a session from the store
     * @param sessionId
     * @returns {Promise<result>}
     */
    delete(sessionId) {
        return new Promise((resolve, reject) => {
            this.redis.del(sessionId, (err) => {
                if (err)
                    return reject(err);
                resolve('OK')
            })
        })
    }
}

export default RedisSessionStore;