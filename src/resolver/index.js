import ResolverProxy from './proxy';
import ResolverDefault from './default';

const resolvers = [
    new ResolverProxy(),
    new ResolverDefault()
];

export default class Resolver {

    static id() {
        return false
    }

    static init() {
        return new Promise(async (resolve) => {
            try {
                for (let i = 0; i < resolvers.length; i++) {
                    await resolvers[i].init()
                }
                resolve()
            } catch (e) {
                reject(e)
            }
        })
    }

    static canResolve(path) {
        return new Promise(async (resolve) => {
            for (let i = 0; i < resolvers.length; i++) {
                try {
                    const res = await resolvers[i].canResolve(path)
                    if (res)
                        return resolve(true)
                } catch (e) { console.log(e); }
            }
            return resolve(false)
        })
    }

    static resolve(path) {
        return new Promise(async (resolve) => {
            for (let i = 0; i < resolvers.length; i++) {
                try {
                    const res = await resolvers[i].canResolve(path)
                    if (res) {
                        const out = await resolvers[i].resolve(path)
                        return resolve(out)
                    }
                } catch (e) { console.log(e); }
            }
            return resolve(false)
        })
    }

    static canResolveLocal(path) {
        return new Promise(async (resolve) => {
            const resList = resolvers.filter((r) => (r.id() !== 'proxy'))
            for (let i = 0; i < resList.length; i++) {
                try {
                    const res = await resList[i].canResolve(path)
                    if (res)
                        return resolve(true)
                } catch (e) { console.log(e); }
            }
            return resolve(false)
        })
    }

    static resolveLocal(path) {
        return new Promise(async (resolve) => {
            const resList = resolvers.filter((r) => (r.id() !== 'proxy'))
            for (let i = 0; i < resList.length; i++) {
                try {
                    const res = await resolvers[i].canResolve(path)
                    if (res) {
                        const out = await resolvers[i].resolve(path)
                        return resolve(out)
                    }
                } catch (e) { console.log(e); }
            }
            return resolve(false)
        })
    }
}
