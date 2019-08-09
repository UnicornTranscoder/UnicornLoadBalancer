import { plexUrl, time, publicUrl } from './utils';
const request = require('request-promise-native');
const parser = require('fast-xml-parser');
const he = require('he');
const moment = require('moment');
import Compute from '@google-cloud/compute';
const {DNS} = require('@google-cloud/dns');
import fetch from 'node-fetch';

const xmlOptions = {
    attributeNamePrefix : "",
    attrNodeName: "attr", //default is 'false'
    textNodeName : "#text",
    ignoreAttributes : false,
    ignoreNameSpace : false,
    allowBooleanAttributes : false,
    parseNodeValue : true,
    parseAttributeValue : true,
    trimValues: true,
    cdataTagName: "__cdata", //default is 'false'
    cdataPositionChar: "\\c",
    localeRange: "", //To support non english character in tag/attribute values.
    parseTrueNumberOnly: false,
    attrValueProcessor: a => he.decode(a, {isAttributeValue: true}),//default is a=>a
    tagValueProcessor : a => he.decode(a) //default is a=>a
};

export class GCPPoolBackend {
    constructor(options) {
        const opts = {
            projectId: options.gcpProject,
            keyFilename: options.credentialsPath,
        }
        this.client = new Compute(opts);
        this.dns = new DNS(opts);
        this.zone = this.dns.zone('dev');
        this.machinesStarting = {};
        this.magicDns = options.magicDns;
    }

    list(opts) {
        return this.client.getVMs({autoPaginate: false, }).then(function(data) {
            return data[0];
        }).then((machines) => {
            return machines.filter((machine) => {
                return machine.metadata.tags.items.some((tag) => {
                    return tag.indexOf('transcoder') !== -1;
                })
             });
        }).then((transcoders) => {
            return transcoders.map((transcoder) => {
                const zone = this.client.zone(transcoder.zone.id);
                const vm = zone.vm(transcoder.metadata.name);
                const locationTag = transcoder.metadata.tags.items.find((tag) => {
                    return tag.indexOf('transcoder') !== -1;
                });
                const tagParts = locationTag.split('-');
                const location = tagParts[1];
                return {
                    name: transcoder.metadata.name,
                    location: location,
                    status: transcoder.metadata.status,
                    backend: {
                        zone: zone,
                        vm: vm,
                    }
                }
            }).filter((transcoder) => {
                if (!opts) {
                    return true;
                }
                if (opts.running) {
                    return transcoder.status.toLowerCase() === 'running';
                }
                return true
            });
        })
    }

    lookupIp(vm) {
        const backendVm = vm.backend.vm;
        return backendVm.get().then((resp) => {
            if (resp.length < 2) {
                return undefined;
            }
            const vmResp = resp[1];
            if (vmResp.networkInterfaces.length == 0) {
                return undefined;
            }
            const nic = vmResp.networkInterfaces[0];
            if (nic.accessConfigs.length == 0) {
                return undefined;
            }
            const ac = nic.accessConfigs[0];
            if ((ac.natIP === undefined) || (ac.natIP === null) || (ac.natIP.length === 0)) {
                return undefined;
            }
            return ac.natIP;
        })
    }
    
    waitForIp(vm) {
        const waitLoop = (resolve, reject) => {
            return this.lookupIp(vm).then((ip) => {
                if (ip !== undefined) {
                    return resolve(ip);
                }
                setTimeout(() => {
                    waitLoop(resolve, reject);
                }, 1000);
            }).catch((err) => {
                return reject(err);
            });
        };
        return new Promise((resolve, reject) => {
            return waitLoop(resolve, reject);
        });
    }

    dnsChangeDone(change) {
        return change.get().then((resp) => {
            const c = resp[1];
            return c.status === 'done';
        })
    }

    watchDnsChange(change) {
        const waitLoop = (resolve, reject) => {
            return this.dnsChangeDone(change).then((done) => {
                if (done) {
                    return resolve(done);
                }
                setTimeout(() => {
                    waitLoop(resolve, reject);
                }, 1000);
            }).catch((err) => {
                return reject(err);
            });
        };
        return new Promise((resolve, reject) => {
            return waitLoop(resolve, reject);
        });
    }

    waitForVmState(vm, state) {
        const backendVm = vm.backend.vm;
        const waitLoop = (resolve, reject) => {
            return backendVm.get().then((resp) => {
                const fetchedStatus = resp[0].metadata.status;
                if (state.toLowerCase() === fetchedStatus.toLowerCase()) {
                    return resolve(state);
                }
                setTimeout(() => {
                    waitLoop(resolve, reject);
                }, 1000);
            }).catch((err) => {
                return reject(err);
            });
        };
        return new Promise((resolve, reject) => {
            return waitLoop(resolve, reject);
        });
    }

    setDns(vm, ip, hostname) {
        return this.zone.getRecords().then((resp) => {
            const records = resp[0];
            const oldApiRecord = records.find((record) => {
                return record.type === 'A' && record.name === hostname;
            });
            const oldRecord = oldApiRecord ? this.zone.record('a', {
                name: oldApiRecord.name,
                data: oldApiRecord.data,
                ttl: oldApiRecord.ttl,
            }) : undefined;

            const addRecord = this.zone.record('a', {
                name: hostname,
                data: ip,
                ttl: 60
            });

            const change = {
                delete: oldRecord ? [oldRecord] : [],
                add: [addRecord],
            };
            return zone.createChange(change);
        }).then((changeResp) => {
            const changeID = changeResp[1].id;
        	const change = this.zone.change(changeID);
        	return this.watchDnsChange(change);
        }).then(() => {
            vm.hostname = hostname;
            vm.ip = ip;
            return vm;
        })
    }

    getDns(vm) {
        const ipPromise = this.waitForIp(vm);
        const dnsPromise = this.zone.getRecords().then((resp) => {
            return resp[0];
        });
        return Promise.all([ipPromise, dnsPromise]).then((resp) => {
            const ip = resp[0];
            const dnsRecords = resp[1];
            const recordMatch = dnsRecords.find((record) => {
                if (record.type !== 'A') {
                    return false;
                }
                return record.data.indexOf(ip) !== -1;
            });
            if (recordMatch !== undefined) {
                return [ip, recordMatch.name];
            }
            return [ip];
        })
    }

    start(vm) {
        if (this.machinesStarting[vm.name] !== undefined) {
            return this.machinesStarting[vm.name];
        }
        const backendVm = vm.backend.vm;
        console.log("Starting VM");
        const startPromise = backendVm.start().then((resp) => {
            console.log("Started VM - Waiting for IP");
            return this.waitForIp(vm);
        }).then((ip) => {
            console.log("Got IP", ip, "Setting DNS");
            return this.setDns(vm, ip, this.magicDns);
        }).then((newVm) => {
            console.log("Waiting for VM to be running");
            return this.waitForVmState(newVm, 'running');
        }).then((state) => {
            console.log("VM Running");
            this.machinesStarting[vm.name] = undefined;
            return Object.assign({}, vm, {
                state: state, 
            });
        });
        this.machinesStarting[vm.name] = startPromise;
        return startPromise;
    }

    stop(vm) {
        const backendVm = vm.backend.vm;
        return backendVm.stop();
    }

}

export class MachinePool {
    
    constructor(backend) {
        this.backend = backend;
        this.leases = {};
    }

    list() {
        return this.backend.list();
    }

    obtain() {
        console.log("Obtaining VM");
        return this.backend.list().then((transcoders) => {
            console.log("Got list");
            const running = transcoders.filter((transcoder) => {
                return transcoder.status.toLowerCase() === 'running';
            });
            if (running.length > 0) {
                console.log("Have a running VM. Use that, but ensure DNS");
                return this.backend.getDns(running[0]).then((items) => {
                    const vm = running[0];
                    if (items.length === 2) {
                        vm.ip = items[0];
                        vm.hostname = items[1];
                    } else if (items.length == 1) {
                        vm.ip = items[0];
                    }
                    return vm;
                })
            }
            console.log("No running VMs. Starting");
            return this.backend.start(transcoders[0]);
        }).then((vm) => {
            if (this.leases[vm.name] === undefined) {
                this.leases[vm.name] = 1;
            } else {
                this.leases[vm.name] += 1;
            }
            return vm;
        });
    }

    release(vm) {
        if (this.leases[vm.name] === undefined) {
            this.leases[vm.name] = 1;
        }
        this.leases[vm.name] -= 1;
        if (this.leases[vm.name] == 0) {
            this.backend.stop(vm);
            this.leases[vm.name] = undefined;
        }
    }

}

export class BackendManager {

    constructor(options) {
        this.timeout = options.timeout;
        this.whitelist = options.whitelist;
        this.pool = options.pool;
        this.pendingContacts = [];
        this.handledContacts = {};
        this.startedVms = [];
    }

    loop() {
        console.log("Performing Backend Loop");
        this.pool.list();
        const pending = this.pendingContacts;
        this.pendingContacts = [];
        console.log("Doing", pending);
        const tokenQueries = pending.map((token) => {
            return this.queryToken(token);
        });
        try {
            const newHandledContacts = {};
            Object.keys(this.handledContacts).forEach((key) => {
                const contact = this.handledContacts[key];
                if (contact.timestamp.clone().add(this.timeout.quantity, this.timeout.units).isBefore(moment())) {
                    if (contact.vm) {
                        this.pool.release(contact.vm.name);
                    }
                    console.log("Dropping record", contact);
                    return;
                }
                newHandledContacts[key] = contact;
            });
            this.handledContacts = newHandledContacts;
        } catch (err) {
            console.log(err);
        }
        console.log("Handled: ", this.handledContacts);
        // Handle the new tokens
        return Promise.all(tokenQueries).then((tokens) => {
            tokens.forEach((token) => {
                if (token === undefined) {
                    return
                }
                if (this.handledContacts[token.token] !== undefined) {
                    return;
                }
                if (this.whitelist.indexOf(token.username) === -1) {
                    return;
                }
                this.handledContacts[token.token] = token;
            });
        }).then(() => {
            // Everything has been settled. Scan the tokens for those without VM assignments.
            const tokensNeedingVM = [];
            Object.keys(this.handledContacts).forEach((key) => {
                if (this.handledContacts[key].vm === undefined) {
                    tokensNeedingVM.push(key);
                } 
            });
            if (tokensNeedingVM.length === 0) {
                return
            }
            console.log("Tokens have not been assigned VMs");
            return this.pool.obtain().then((vm) => {
                tokensNeedingVM.forEach((key) => {
                    this.handledContacts[key].vm = vm;
                });
            });
        }).catch((err) => {
            console.log(err);
        });
    }

    transcoderUrlForToken(plexToken, session, ip) {
        const contact = this.handledContacts[plexToken];
        const hostname = `https://${contact.vm.hostname.slice(0, -1)}`;
        const origin = encodeURIComponent(publicUrl())
        return fetch(`${hostname}/api/resolve?session=${session}&ip=${ip}&origin=${origin}`)
        .then(res => res.json())
        .then(body => body.client)
    }

    queueLoop() {
        setTimeout(() => {
            return this.loop().then(() => {
                this.queueLoop();
            }).catch((err) => {
                this.queueLoop();
            });
        }, 5000);
    }

    start() {
        console.log("Starting Backend Manager Loop");
        this.queueLoop();
    }

    queryToken(token) {
        const url = `${plexUrl()}myplex/account\?X-Plex-Token=${token.token}`;
        console.log(url);
        return request({uri: url, resolveWithFullResponse: true}).then((response) => {
            const jsonObj = parser.parse(response.body, xmlOptions);
            console.log(jsonObj);
            if ((jsonObj['MyPlex']) && (jsonObj['MyPlex'].attr) && (jsonObj['MyPlex'].attr['username']) && (jsonObj['MyPlex'].attr['username'].length > 0)) {
                return Object.assign({}, token, {
                    username: jsonObj['MyPlex'].attr['username'],
                    timestamp: moment(),
                    vm: undefined,
                });
            }
            return undefined;
        }).catch((err) => {
            console.log(err);
            return undefined;
        })
    }

    registerContact(token, ip) {
        if (this.handledContacts[token] !== undefined) {
            this.handledContacts[token].timestamp = moment();
            return;
        }
        const match = this.pendingContacts.find((contact) => {
            return contact.token === token;
        })
        if (match === undefined) {
            console.log("Queued token", token);
            this.pendingContacts.push({
                token: token,
                ip: ip,
            })
        }
    }

}