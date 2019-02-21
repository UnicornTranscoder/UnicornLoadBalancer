import config from '../config';
import SqliteDatabase from './sqlite';
import PostgresqlDatabase from './postgresql';
import debug from 'debug';

// Debugger
const D = debug('UnicornLoadBalancer');

let Database;

if (config.database.mode === 'sqlite') {
    D('Using sqlite as database');
    Database = new SqliteDatabase();
} else if (config.database.mode === 'postgresql') {
    D('Using postgresql as database');
    Database = new PostgresqlDatabase();
}

export default Database;