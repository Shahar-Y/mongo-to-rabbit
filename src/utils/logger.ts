import { MTROptions } from '../paramTypes';

export const prefixLog: String = 'MTR ===> ';

export function criticalLog(message: any): void {
  console.error(`${prefixLog} ${message}`);
}

export default class Logger {
  options: MTROptions;

  constructor(options: MTROptions) {
    this.options = options;
  }

  log(message: string | object): void {
    const isObject = !(
      typeof message === 'string' || message instanceof String
    );

    if (!(this.options.silent || isObject))
      console.log(`${prefixLog} ${message}`);
    else if (!this.options.silent && isObject) console.log(message);
  }
}
