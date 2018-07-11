/**
 * Created by Maxime Baconnais on 29/08/2017.
 */

module.exports = {
	cluster: [
		'https://transcoder1.myplex.com',
		'https://transcoder2.myplex.com'
	],
	preprod: {
		enabled: false,
		devIps: [
			'127.0.0.1/32'
		],
		server: 'https://beta-transcoder.myplex.com'
	},
	plex: {
		host: 'localhost',
		port: 32400,
		sessions: '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Cache/Transcode/Sessions',
		database: '/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db'
	},
	loadBalancer: {
		port: 3001
	},
	alerts: {
		discord: ''
	},
	productName: 'UnicornLoadBalancer'
};
