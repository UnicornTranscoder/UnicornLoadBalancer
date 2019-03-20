import ResolverProxy from './proxy';

const resolvers = [
    new ResolverProxy()
];

export default class ResolverProxy {

    static id() {
        return false
    }

    static init() {
        return new Promise((resolve) => {
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
        return new Promise((resolve) => {
            try {
                for (let i = 0; i < resolvers.length; i++) {
                    let res = await resolvers[i].canResolve(path)
                    if (res)
                        return resolve(true)
                }
                return resolve(false)
            } catch (e) {
                return resolve(false)
            }
        })
    }

    static resolve(path) {
        return new Promise((resolve) => {
            for (let i = 0; i < resolvers.length; i++) {
                try {
                    let res = await resolvers[i].resolve(path)
                    if (res)
                        return resolve(true)
                } catch (e) {
                    return resolve(false)
                }
            }
            return resolve(false)
        })
    }
}