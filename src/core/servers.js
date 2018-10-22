let servers = [];

let ServersManager = {};

ServersManager.add = (url) => {
    if (servers.indexOf(url) !== -1)
        return (false);
    servers.push(url);
    return (true);
};

ServersManager.remove = (url) => {
    servers = server.filter((e) => (e !== url));
    return (true);
};

ServersManager.list = () => {
    return (servers);
}

// Calculate server score
ServersManager.calculateScore = (stats) => {
	// The configuration is unavailable, the server is probably unavailable
	if (!stats)
		return (1000);

	// Default load 0
	let load = 0;

	// Each transcode add 1 to the load
	load += stats.transcoding;

	// Each HEVC sessions add 1.5 to the load
	if (stats.codecs.hevc)
		load += stats.codecs.hevc * 1.5;

	// Server already have too much sessions
	if (stats.config && stats.sessions >= stats.config.preferredMaxSessions)
		load += 2.5;

	// Server already have too much transcodes
	if (stats.config && stats.transcoding >= stats.config.preferredMaxTranscodes)
		load += 5;

	// Server already have too much downloads
	if (stats.config && stats.downloads >= stats.config.preferredMaxDownloads)
		load += 1;

	// Return load
	return (load);
}

// Calculate all the server scores
ServersManager.scores = () => {
    let output = {};
    ServersManager.list().forEach((e) => {
        output[e] = ServersManager.calculateScore(); // Todo: Bind stats in call
    });
    return (output);
}

// Returns all the server stats
ServersManager.stats = () => {
    let output = {};
    ServersManager.list().forEach((e) => {
        output[e] = false; // Todo: Bind stats
    });
    return (output);
}

export default ServersManager;
