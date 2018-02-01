/**
 * Created by drouar_b on 01/02/2018.
 */

const path = require('path');
const reload = require('require-reload')(require);
const config = require('../config');

class ReloadConf {
    static reloadConf(req, res) {
        res.setHeader('Content-Type', 'application/json');

        try {
            reload(path.resolve('config.js'));
            let newConf = require('../config');

            Object.keys(newConf).map((key) => {
                config[key] = newConf[key];
            });

            res.send(JSON.stringify(config));
        } catch (e) {
            console.log(e);
            res.send(JSON.stringify({
                error: "Config reload Failed"
            }))
        }
    }
}

module.exports = ReloadConf;