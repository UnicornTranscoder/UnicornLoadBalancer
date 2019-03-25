import ResolverProxy from './proxy';
import ResolverDefault from './default';

const resolvers = [
    new ResolverProxy(),
    new ResolverDefault()
];

export default class ResolverProxy {

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
                } catch (e) { }
            }
            return resolve(false)
        })
    }

    static resolve(path) {
        return new Promise(async (resolve) => {
            for (let i = 0; i < resolvers.length; i++) {
                try {
                    const res = await resolvers[i].resolve(path)
                    if (res)
                        return resolve(res)
                } catch (e) { }
            }
            return resolve(false)
        })
    }
}