const request = require('request');

const config = require('../config');

let serversStats = {};

const getInformations = () => {
	config.cluster.map((url) => {
		request(url + '/api/stats', (error, response, body) => {
			serversStats[url] = (!error) ? JSON.parse(body) : false;
		})
	});
};

setInterval(() => {
	getInformations();
}, 2000);

getInformations();

module.exports = serversStats;