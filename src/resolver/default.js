export default class ResolverDefault {

    id() {
        return 'default'
    }

    init() {
        return new Promise((resolve) => {
            resolve()
        })
    }

    canResolve() {
        return new Promise((resolve) => {
            resolve(true)
        })
    }

    resolve(path) {
        return new Promise((resolve) => {
            resolve({
                type: 'LOCAL',
                direct: false,
                path
            })
        })
    }
}