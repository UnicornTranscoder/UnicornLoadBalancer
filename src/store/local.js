import EventEmitter from 'events';

class LocalSessionStore {
    constructor() {
        this.sessionEvents = new EventEmitter();
        this.sessionStore = {};
    }

    /**
     * Get a session, or wait for it for 10s
     * @param sessionId
     * @returns {Promise<session>}
     */
    get(sessionId) {
        return new Promise((resolve, reject) => {
            if (sessionId in this.sessionStore)
                return resolve(this.sessionStore[sessionId]);

            let timeout = null;

            let eventCb = (...args) => {
                clearTimeout(timeout);
                this.sessionEvents.removeListener(sessionId, eventCb);
                resolve(...args);
            };

            let timeoutCb = () => {
                this.sessionEvents.removeListener(sessionId, eventCb);
                reject('timeout');
            };

            timeout = setTimeout(timeoutCb, 10000);
            this.sessionEvents.on(sessionId, eventCb);
        })
    }

    /**
     * Store a value in the store and trigger the pending gets
     * @param sessionId
     * @param value
     * @returns {Promise<redis result>}
     */
    set(sessionId, value) {
        return new Promise((resolve) => {
            this.sessionStore[sessionId] = value;
            this.sessionEvents.emit(sessionId, value);
            resolve('OK');
        })
    }
}

export default LocalSessionStore;