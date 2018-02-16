const request = require('request');

const config = require('../config');

let serversStats = {};

const getInformations = () => {
	console.log(serversStats);
	config.cluster.map((url) => {
		request(url + '/api/stats', (error, response, body) => {
			if (!error)
				serversStats[url] = JSON.parse(body);
		})
	});
};

setInterval(() => {
	getInformations();
}, 2000);

getInformations();

module.exports = serversStats;