## UnicornLoadBalancer

This software is a part of __UnicornTranscoder__ project, it's the LoadBalancer that will catch Plex requests and send them to a __UnicornTranscoder__.

## UnicornTranscoder Project

* [UnicornTranscoder](https://github.com/UnicornTranscoder/UnicornTranscoder)
* [UnicornLoadBalancer](https://github.com/UnicornTranscoder/UnicornLoadBalancer)
* [UnicornFFMPEG](https://github.com/UnicornTranscoder/UnicornFFMPEG)

## Dependencies

* Plex Media Server
* NodeJS
* RedisCache (Optionnal)

## Setup

### 1. Installation

* Clone the repository
* Install with `npm install`
* Setup some environnement variables to configure the *UnicornLoadBlancer*

| Name | Description | Type | Default |
| ----------------- | ------------------------------------------------------------ | ------| ------- |
| **SERVER_HOST** | Host to access to the *UnicornLoadBalancer* | `string` | `127.0.0.1` |
| **SERVER_PORT** | Port used by the *UnicornLoadBalancer* | `int` | `3001` |
| **SERVER_SSL** | If HTTPS is enabled or not on the *UnicornLoadBalancer* | `bool` | `false` |
| **PLEX_HOST** | Host to access to Plex | `string` | `127.0.0.1` | 
| **PLEX_PORT** | Port used by Plex | `int` | `32400` | 
| **PLEX_PATH_USR** | The Plex's path | `string` | `/usr/lib/plexmediaserver/` | 
| **PLEX_PATH_SESSIONS** | The path where Plex store sessions (to grab external subtitles) | `string` | `/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Cache/Transcode/Sessions` | 
| **PLEX_PATH_DATABASE** | The path of the Plex database | `string` | `/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db` |
| **REDIS_HOST** | The host of the redis database | `string|undefined` | `undefined` | 
| **REDIS_PORT** | Port used by Redis | `int` | `6379` |
| **REDIS_PASSWORD** | The password of the redis database | `string` | ` ` | 
| **REDIS_DB** | The index of the redis database | `int` | `0` | 
| **SCORES_TIMEOUT** | Seconds to consider a not-pinged server as unavailable | `int` | `10` | 

* Configure Plex Media Server access address
 * In Settings -> Server -> Network
 * Set `Custom server access URLs` to the address to access the UnicornLoadBalancer
* Run with npm start

### 2. Notes

All the requests to this Plex Media Server should pass through the *UnicornLoadBalancer*, if someone reach the server directly he will not be able to start a stream, since FFMPEG binary has been replaced. It is recomended to setup a nginx as reverse proxy in front to setup a SSL certificate and to have an iptable to direct access to the users on port 32400.

```
#Example iptable
#Allow transcoders to reach the Plex Media Server
iptables -A INPUT -p tcp --dport 32400 -i eth0 -s <transcoderIP> -j ACCEPT
#Deny all other incoming connections
iptables -A INPUT -p tcp --dport 32400 -i eth0 -j DROP
```
