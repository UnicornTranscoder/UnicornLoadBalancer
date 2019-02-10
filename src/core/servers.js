import fetch from 'node-fetch';
import { time } from '../utils';
import config from '../config';

let servers = {};

let ServersManager = {};

// Add or update a server
ServersManager.update = (e) => {
	const name = (e.name) ? e.name : (e.url) ? e.url : '';
	if (!name)
		return (ServersManager.list());
	servers[name] = {
		name,
		sessions: ((!Array.isArray(e.sessions)) ? [] : e.sessions.map((s) => ({
			id: ((s.id) ? s.id : false),
			status: ((s.status && ['DONE', 'DOWNLOAD', 'TRANSCODE'].indexOf(s.status.toUpperCase()) !== -1) ? s.status.toUpperCase() : false),
			codec: ((s.codec) ? s.codec : false),
			lastChunkDownload: ((s.lastChunkDownload) ? s.lastChunkDownload : 0)
		}))).filter((s) => (s.id !== false && s.status !== false)),
		settings: {
			maxSessions: ((typeof (e.settings) !== 'undefined' && typeof (e.settings.maxSessions) !== 'undefined') ? parseInt(e.settings.maxSessions) : 0),
			maxDownloads: ((typeof (e.settings) !== 'undefined' && typeof (e.settings.maxDownloads) !== 'undefined') ? parseInt(e.settings.maxDownloads) : 0),
			maxTranscodes: ((typeof (e.settings) !== 'undefined' && typeof (e.settings.maxTranscodes) !== 'undefined') ? parseInt(e.settings.maxTranscodes) : 0),
		},
		url: ((e.url) ? e.url : false),
		time: time()
	};
	return (ServersManager.list());
};

// Remove a server
ServersManager.remove = (e) => {
	const name = (e.name) ? e.name : (e.url) ? e.url : '';
	delete servers[name];
	return (ServersManager.list());
};

// List all the servers with scores
ServersManager.list = () => {
	let output = {};
	Object.keys(servers).forEach((i) => {
		output[i] = { ...servers[i], score: ServersManager.score(servers[i]) };
	});
	return (output);
}

// Chose best server
ServersManager.chooseServer = (ip = false) => {
	return (new Promise((resolve, reject) => {
		let tab = [];
		const list = ServersManager.list();
		Object.keys(list).forEach((i) => {
			tab.push(list[i]);
		});
		tab.sort((a, b) => (a.score - b.score));
		if (typeof (tab[0]) === 'undefined')
			return resolve(false);
		fetch(tab[0].url + '/api/resolve?ip=' + ip)
			.then(res => res.json())
			.then(body => {
				return resolve(body.client)
			});
	}));
};

// Calculate server score
ServersManager.score = (e) => {
	// The configuration wasn't updated since X seconds, the server is probably unavailable
	if (time() - e.time > config.scores.timeout)
		return (100);

	// Default load 0
	let load = 0;

	// Add load value for each session
	e.sessions.forEach((s) => {

		// Transcode streams
		if (s.status === 'TRANSCODE') {
			load += 1;
			if (s.codec === 'hevc') {
				load += 1.5;
			}
		}

		// Serving streams
		if (s.status === 'DONE') {
			load += 0.5;
		}

		// Download streams
		if (s.status === 'DOWNLOAD') {
			load += 0.25;
		}
	})

	// Server already have too much sessions
	if (e.sessions.filter((s) => (['TRANSCODE', 'DONE'].indexOf(s.status) !== -1)).length > e.settings.maxSessions)
		load += 2.5;

	// Server already have too much transcodes
	if (e.sessions.filter((s) => (['TRANSCODE'].indexOf(s.status) !== -1)).length > e.settings.maxTranscodes)
		load += 5;

	// Server already have too much downloads
	if (e.sessions.filter((s) => (['DOWNLOAD'].indexOf(s.status) !== -1)).length > e.settings.maxDownloads)
		load += 1;

	// Return load
	return (load);
}

// Returns our ServersManager
export default ServersManager;
