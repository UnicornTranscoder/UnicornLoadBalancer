const snekfetch = require("snekfetch");
const endpoint = "https://discordapp.com/api/v6/webhooks";

class Webhook {
    constructor(url) {
        this.url = url;
        this.id = '';
        this.token = '';
        this.meta = {};
    }

    getWebhookProps() {
        return new Promise((resolve, reject) => {
            snekfetch.get(this.url)
                .then((res) => {
                    let parsed = JSON.parse(res.text);
                    Object.assign(this.meta, parsed);
                    this.id = parsed['id'];
                    this.token = parsed['token'];
                    resolve();
                })
                .catch((err) => {
                    throw err;
                })
        })

    }

    checkEndpoint(payload) {
        if (!this.endpoint) this.getWebhookProps().then( () => 
            this.sendPayload(payload)
        )
        else this.sendPayload(payload)
    }

    sendPayload(payload) {
        return new Promise((resolve, reject) => {
            snekfetch.post(this.endpoint)
                .send(payload)
                .then(() => {
                    resolve()
                })
                .catch((err) => {
                    reject(err.text)
                })
        });
    }

    get endpoint() {
        if (this.id == '' || this.token == '') return false;
        return `${endpoint}/${this.id}/${this.token}/slack`
    }

    err(name, message) {
        let payload = {
            "username": name,
            "text": "[]()",
            "attachments": [{
                "color": "#ff0000",
                "fields": [{
                    "title": "Error",
                    "value": message
                }],
                "ts": new Date() / 1000
            }]
        };

        return this.checkEndpoint(payload);
    }

    info(name, message) {
        let payload = {
            "username": name,
            "text": "[]()",
            "attachments": [{
                "color": "#00fffa",
                "fields": [{
                    "title": "Information",
                    "value": message
                }],
                "ts": new Date() / 1000
            }]
        };

        return this.checkEndpoint(payload);
    }

    success(name, message) {
        let payload = {
            "username": name,
            "text": "[]()",
            "attachments": [{
                "color": "#04ff00",
                "fields": [{
                    "title": "Success",
                    "value": message
                }],
                "ts": new Date() / 1000
            }]
        };

        return this.checkEndpoint(payload);
    }

    warn(name, message) {
        let payload = {
            "username": name,
            "text": "[]()",
            "attachments": [{
                "color": "#ffe900",
                "fields": [{
                    "title": "Warning",
                    "value": message
                }],
                "ts": new Date() / 1000
            }]
        };

        return this.checkEndpoint(payload);
    }

    custom(name, message, title, color) {
        let payload;
        if (color) {
            payload = {
                "username": name,
                "text": "[]()",
                "attachments": [{
                    "color": color,
                    "fields": [{
                        "title": title,
                        "value": message
                    }],
                    "ts": new Date() / 1000
                }]
            }
        } else {
            payload = {
                "username": name,
                "text": "[]()",
                "attachments": [{

                    "fields": [{
                        "title": title,
                        "value": message
                    }],
                    "ts": new Date() / 1000
                }]
            }
        }

        return this.checkEndpoint(payload);
    }
}

module.exports = Webhook;