import config from '../config';
import RedisSessionStore from './redis';
import LocalSessionStore from './local';
import debug from 'debug';
// Debugger
const D = debug('UnicornLoadBalancer:SessionStore');


let SessionStore;

if (config.redis.host !== 'undefined') {
    D('Using redis as session store');
    SessionStore = new RedisSessionStore();
} else {
    D('Redis not found, fallback on LocalSessionStore');
    D('WARNING: On restart all sessions will be lost');
    SessionStore = new LocalSessionStore();
}

export default SessionStore;
