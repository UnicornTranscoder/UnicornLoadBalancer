const request = require('request');

const Webhook = require("../core/discord");
const config = require('../config');

let serversStats = {};

const sendAlertDead = (url) => {
	if (config.alerts.discord) {
		const Hook = new Webhook(config.alerts.discord);
		Hook.err(config.productName, "The server `"+url+"` is now unavailable.");
	}
};

const sendAlertAlive = (url) => {
	if (config.alerts.discord) {
		const Hook = new Webhook(config.alerts.discord);
		Hook.success(config.productName, "The server `"+url+"` is now available.");		
	}
};

const getInformations = () => {
	config.cluster.map((url) => {
		request(url + '/api/stats', (error, response, body) => {
			try {
				if (!error)
				{
					const notif = (serversStats[url] === false);
					serversStats[url] = JSON.parse(body);
					if (notif)
						sendAlertAlive(url);
				}
				else
				{
					if (serversStats[url] !== false)
						sendAlertDead(url);
					serversStats[url] = false;
				}
			}
			catch (err) {
				if (serversStats[url] !== false)
					sendAlertDead(url);
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