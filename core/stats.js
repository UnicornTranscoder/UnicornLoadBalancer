const request = require('request');

const config = require('../config');

let serversStats = {};

const getInformations = () => {
	config.cluster.map((url) => {
		request(url + '/api/stats', (error, response, body) => {
			try {
				serversStats[url] = (!error) ? JSON.parse(body) : false;
			}
			catch(err) {
				serversStats[url] = false;
			}
		})
	});
};

setInterval(() => {
	getInformations();
}, 2000);

getInformations();

module.exports = serversStats;