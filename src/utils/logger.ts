import { MTROptions } from '../paramTypes';

export default function log(message: string | object, options: MTROptions, isObject = false) : void {
    if(!options.silent && !isObject) {
        console.log(`MTR: ===> ${message}`)
    } else if(!options.silent && isObject) {
        console.log(message) 
    }
}
