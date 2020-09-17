import { MTROptions } from '../paramTypes';

export function log(message: string | object, options: MTROptions, isObject = false) {
    if(!options.silent && !isObject) {
        console.log(`MTR: ===> ${message}`)
    } else if(!options.silent && isObject) {
        console.log(message)
    }
}