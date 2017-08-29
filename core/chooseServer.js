/**
 * Created by Maxime Baconnais on 29/08/2017.
 */
 
const config = require('../config');

let chooseServer = (session) => {
	return (config.cluster[0]);
};

module.exports = chooseServer;