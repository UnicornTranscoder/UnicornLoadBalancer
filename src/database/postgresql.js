import config from '../config';

let PostgresqlDatabase = {};

PostgresqlDatabase.getPart = (part_id) => (new Promise((resolve, reject) => {
    return reject('FILE_NOT_FOUND');
}))

export default PostgresqlDatabase;