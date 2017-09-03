/**
 * Created by Maxime Baconnais on 29/08/2017.
 */
 
const config = require('../config');

let chooseServer = (session, ip) => {
	if (ip === '91.121.222.224')
		return (config.cluster[1]);
	return (config.cluster[0]);
};

module.exports = chooseServer;