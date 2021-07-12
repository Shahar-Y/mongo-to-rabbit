import { MTROptions } from '../paramTypes';

export default class Logger {
  options: MTROptions;

  constructor(options: MTROptions) {
    this.options = options;
  }

  log(message: string | object, isObject = false): void {
    if (!(this.options.silent || isObject)) console.log(`MTR: ===> ${message}`);
    else if (!this.options.silent && isObject) console.log(message);
  }
}
