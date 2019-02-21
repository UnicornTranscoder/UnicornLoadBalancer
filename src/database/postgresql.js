import config from '../config';

let PostgresqlDatabase = {};

PostgresqlDatabase.getPartFromId = (part_id) => (new Promise((resolve, reject) => {
    return reject('FILE_NOT_FOUND');
}))

PostgresqlDatabase.getPartFromPath = (path) => (new Promise((resolve, reject) => {
    return reject('FILE_NOT_FOUND');
}))

export default PostgresqlDatabase;