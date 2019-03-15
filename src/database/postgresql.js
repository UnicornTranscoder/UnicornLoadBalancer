import { Client } from 'pg';
import config from '../config';

let PostgresqlDatabase = {};

const _getClient = () =>
  new Promise(async (resolve, reject) => {
    const client = new Client({
      user: config.database.postgresql.user,
      host: config.database.postgresql.host,
      database: config.database.postgresql.database,
      password: config.database.postgresql.password,
      port: config.database.postgresql.port,
    });
    client.on('error', (err) => {
      return reject(err);
    });
    await client.connect();
    return resolve(client);
  });

PostgresqlDatabase.getPartFromId = (part_id) =>
  new Promise((resolve, reject) => {
    _getClient()
      .then((client) => {
        client.query('SELECT * FROM media_parts WHERE id=$1 LIMIT 1', [part_id], (err, res) => {
          if (err) return reject(err);
          client.end();
          if (res.rows.length) {
            return resolve(res.rows[0]);
          } else {
            return reject('FILE_NOT_FOUND');
          }
        });
      })
      .catch((err) => {
        return reject('DATABASE_ERROR');
      });
  });

PostgresqlDatabase.getPartFromPath = (path) =>
  new Promise((resolve, reject) => {
    _getClient()
      .then((client) => {
        client.query('SELECT * FROM media_parts WHERE file=$1 LIMIT 1', [path], (err, res) => {
          if (err) {
            return reject(err);
          }
          client.end();
          if (res.rows.length) {
            return resolve(res.rows[0]);
          } else {
            return reject('FILE_NOT_FOUND');
          }
        });
      })
      .catch((err) => {
        return reject('DATABASE_ERROR');
      });
  });

export default PostgresqlDatabase;
