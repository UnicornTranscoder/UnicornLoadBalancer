import { publicUrl } from "../utils";
import Database from "../database";
import config from "../config";

export default class ResolverProxy {

    id() {
        return 'proxy'
    }

    init() {
        return new Promise((resolve) => {
            resolve()
        })
    }

    canResolve(path) {
        return new Promise((resolve) => {
            console.log('CAN RESOLVE', path, config.custom.medias.replicated)
            resolve(!config.custom.medias.replicated)
        })
    }

    resolve(path) {
        return new Promise(async (resolve, reject) => {
            try {
                const data = await Database.getPartFromPath(path);
                if (typeof (data.id) !== 'undefined')
                    return resolve({
                        type: 'URL',
                        direct: true,
                        path: `${publicUrl()}library/parts/${data.id}/0/file.stream?download=1`
                    });
            } catch (e) {
                return reject(e)
            }
            return reject(new Error('NOT_FOUND'))
        })
    }
}