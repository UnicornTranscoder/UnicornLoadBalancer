import { publicUrl } from "../utils";
import Database from "../database";
import config from "../config";

export default class ResolverProxy {

    id() {
        return 'default'
    }

    init() {
        return new Promise((resolve) => {
            resolve()
        })
    }

    canResolve(path) {
        return new Promise((resolve) => {
            resolve(!config.custom.download.forward)
        })
    }

    resolve(path) {
        return new Promise((resolve, reject) => {
            try {
                const data = await Database.getPartFromPath(path);
                if (typeof (data.id) !== 'undefined')
                    return resolve(`${publicUrl()}library/parts/${data.id}/0/file.stream?download=1`);
            } catch (e) {
                return reject(e)
            }
        })
    }
}