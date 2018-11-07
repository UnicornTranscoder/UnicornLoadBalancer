## UnicornLoadBalancer

This software is a part of __UnicornTranscoder__ project, it's the LoadBalancer that will catch Plex requests and send them to a __UnicornTranscoder__.

## UnicornTranscoder Project

* [UnicornTranscoder](https://github.com/UnicornTranscoder/UnicornTranscoder)
* [UnicornLoadBalancer](https://github.com/UnicornTranscoder/UnicornLoadBalancer)
* [UnicornFFMPEG](https://github.com/UnicornTranscoder/UnicornFFMPEG)

## Dependencies

* Plex Media Server
* NodeJS

## Setup

### 1. Installation

* Clone the repository
* Install with `npm install`
* Edit the configuration

| Variable          | Description                                                  |
| ----------------- | ------------------------------------------------------------ |
| cluster           | Array of UnicornTranscoder Servers in the cluster            |
| preprod           | If enabled, will filter on IP and send to the configured UnicornTranscoder, it allows to have a UnicornTranscoder server for developement without impacting users on the Plex Media Server |
| plex              | Configuration of the Plex Media server                       |
| >host             | Address to join the Plex Media Server                        |
| >port             | Port of the Plex Media server                                |
| >sessions         | Where Plex store sessions (to grab external subtitles)       |
| >database         | Plex Media Server Database                                   |
| loadBalancer.port | Port UnicornLoadBalancer will listen                         |
| alerts.discord    | Discord Webhook to notify unavailable UnicornTranscoder      |

* Configure Plex Media Server access Address
  * In Settings -> Server -> Network
  * Set `Custom server access URLs` to the address to access the UnicornLoadBalancer
* Run with npm start

## 2. Notes

All the requests to this Plex Media Server should pass by the UnicornLoadBalancer, if someone reach the server directly without passing through UnicornLoadBalancer he will not be able to start a stream, since FFMPEG binary has been replaced. It is recomended to setup a nginx reverse proxy in front to setup a SSL certificate and to have an iptable to direct access to the users on port 32400.

```
#Example iptable
#Allow transcoders to reach the Plex Media Server
iptables -A INPUT -p tcp --dport 32400 -i eth0 -s <transcoderIP> -j ACCEPT
#Deny all other incoming connections
iptables -A INPUT -p tcp --dport 32400 -i eth0 -j DROP
```

