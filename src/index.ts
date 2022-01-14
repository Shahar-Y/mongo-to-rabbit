import Logger, { criticalLog } from './utils/logger';
import { sendFailedMsg, sendMsg } from './utils/message';
import { getRabbitHealthStatus, Rabbit } from './utils/rabbit';
import { MongoDataType, RabbitDataType, MTROptions } from './paramTypes';
import { getMongoHealthStatus, MongoWatcher } from './utils/mongoWatcher';

// Default variables
const defaultOptions: MTROptions = { silent: true, prettify: true, allowTracker: true };

// eslint-disable-next-line import/no-mutable-exports
export let logger: Logger;

/**
 * The main function of the package.
 * Creates the listener to mongo and connects it to rabbit.
 * @param {MongoDataType}   mongoData   - Information related to mongo.
 * @param {RabbitDataType}  rabbitData  - Information related to rabbitMQ.
 * @param {MTROptions}      opts        - an optional parameter. defaults to 'defaultOptions'.
 */
async function watchAndNotify(
  mongoData: MongoDataType,
  rabbitData: RabbitDataType,
  opts?: Partial<MTROptions>
): Promise<void> {
  const options: MTROptions = { ...defaultOptions, ...opts };
  logger = new Logger(options);

  // Check if middleware was defiend in queue but the prettify option is false
  for (const queue of rabbitData.queues) {
    if (!options.prettify && queue.middleware !== undefined) {
      criticalLog('error: middleware option cannot work when prettify is false');
      return;
    }
  }

  // Create rabbit and mongowatcher connection instances
  const rabbitConn = new Rabbit(rabbitData);
  const mongoWatcherConn = new MongoWatcher(mongoData, rabbitData, options);

  // Init rabbit connection
  await rabbitConn.initRabbit();
  rabbitConn.ensureRabbitHealth(mongoWatcherConn);
  logger.log('successful connection to all queues in rabbit');

  // Init mongo connection
  mongoWatcherConn.mongoConnection();
  logger.log('successful connection to all mongo');

  // If there are failed msg from rabbit, send them
  sendFailedMsg();
}

export { getRabbitHealthStatus, sendMsg, watchAndNotify, getMongoHealthStatus };
