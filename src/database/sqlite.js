import sqlite3 from 'sqlite3';
import config from '../config';

let SqliteDatabase = {};

SqliteDatabase.getPart = (part_id) => (new Promise((resolve, reject) => {
    try {
        const db = new (sqlite3.verbose().Database)(config.database.sqlite.path);
        db.get('SELECT * FROM media_parts WHERE id=? LIMIT 0, 1', part_id, (err, row) => {
            if (row && row.file)
                resolve(row);
            else
                reject('FILE_NOT_FOUND');
            db.close();
        });
    }
    catch (err) {
        return reject('FILE_NOT_FOUND');
    }
}))

export default SqliteDatabase;