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
* Postgresql (Optionnal)

## Setup

### 1. Installation

* Clone the repository
* Install with `npm install`
* Setup some environnement variables to configure the *UnicornLoadBlancer*

| Name | Description | Type | Default |
| ----------------- | ------------------------------------------------------------ | ------| ------- |
| **SERVER_HOST** | Host to access to the *UnicornLoadBalancer* | `string` | `127.0.0.1` |
| **SERVER_PORT** | Port used by the *UnicornLoadBalancer* | `int` | `3001` |
| **SERVER_PUBLIC** | Public url where the *UnicornLoadBalancer* can be called, **with** a slash at the end | `string` | `http://127.0.0.1:3001/` |
| **PLEX_HOST** | Host to access to Plex | `string` | `127.0.0.1` | 
| **PLEX_PORT** | Port used by Plex | `int` | `32400` | 
| **PLEX_PATH_USR** | The Plex's path | `string` | `/usr/lib/plexmediaserver/` | 
| **PLEX_PATH_SESSIONS** | The path where Plex store sessions (to grab external subtitles) | `string` | `/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Cache/Transcode/Sessions` | 
| **DATABASE_MODE** | Kind of database to use with Plex, can be `sqlite` or `postgresql` | `string` | `sqlite` |
| **DATABASE_SQLITE_PATH** | The path of the Plex d
atabase | `string` | `/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db` |
| **DATABASE_POSTGRESQL_HOST** | Host of the postgresql server | `string` | ` ` |
| **DATABASE_POSTGRESQL_DATABASE** | Name of the postgresql database | `string` | ` ` |
| **DATABASE_POSTGRESQL_USER** | User to use to the Postgresql database| `string` | ` ` |
| **DATABASE_POSTGRESQL_PASSWORD** | Password to use to the Postgresql database | `string` | `sqlite` |
| **REDIS_HOST** | The host of the redis database | `string` `undefined` | `undefined` | 
| **REDIS_PORT** | Port used by Redis | `int` | `6379` |
| **REDIS_PASSWORD** | The password of the redis database | `string` | ` ` | 
| **REDIS_DB** | The index of the redis database | `int` | `0` | 
| **CUSTOM_SCORES_TIMEOUT** | Seconds to consider a not-pinged server as unavailable | `int` | `10` | 
| **CUSTOM_IMAGE_RESIZER** | Enable or disable the custom (Unicorn) image resizer (most efficient than Plex one) | `bool` | `true` | 
| **CUSTOM_IMAGE_PROXY** | Use a proxy to convert images | `string` | ` ` | 
| **CUSTOM_DOWNLOAD_FORWARD** | Enable or disable 302 for download links and direct play | `bool` | `true` | 
| **CUSTOM_SERVERS_LIST** | Transcoder servers set by default, **without** a slash at the end, separate servers with a **comma** | `string array` | `[]` | 

* Configure Plex Media Server access address
 * In Settings -> Server -> Network
 * Set `Custom server access URLs` to the address to access the UnicornLoadBalancer
* Run with npm start

### 2. Notes

All requests to the Plex Media Server should pass through the *UnicornLoadBalancer*, if someone reach the server directly he will not be able to start a stream, since FFMPEG binary has been replaced. To solve this problem it is recomended to configure an iptable to drop direct access on port **32400**.  
It is also recomended to setup a nginx reverse proxy in front of the *UnicornLoadBalancer* to setup a SSL certificate.

```
#Example iptable
#Allow transcoders to reach the Plex Media Server
iptables -A INPUT -p tcp --dport 32400 -i eth0 -s <transcoderIP> -j ACCEPT
#Deny all other incoming connections
iptables -A INPUT -p tcp --dport 32400 -i eth0 -j DROP
```
