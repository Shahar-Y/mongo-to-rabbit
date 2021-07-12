import { menash } from 'menashmq';
import { logger, sleep } from '../index';
import { MongoWatcher } from './mongoWatcher';
import { sendFailedMsg } from '../utils/message';
import { QueueObjectType, RabbitDataType } from '../paramTypes';

/**
 * Get rabbit health status
 * @returns {boolean} isHealthy - true if healthy
 */
export function getRabbitHealthStatus(): boolean {
  return !menash.isClosed && menash.isReady;
}

export class Rabbit {
  rabbitData: RabbitDataType;
  healthCheckInterval: number = 30000;

  constructor(rabbitData: RabbitDataType) {
    this.rabbitData = rabbitData;
    if (rabbitData.healthCheckInterval) this.healthCheckInterval = rabbitData.healthCheckInterval;
  }

  /**
   * Init rabbitmq (connection and queues)
   */
  async initRabbit() {
    await this.initConnection(this.rabbitData.rabbitURI);
    await this.initQueues(this.rabbitData.queues);
  }

  /**
   * Healthcheck for rabbitMQ connection and reconnecting in case of a failer.
   * @param {MongoWatcher} mongoWatcher - mongoWatcher instance
   */
  async connRabbitHealthChecks(mongoWatcher: MongoWatcher) {
    while (true) {
      if (!getRabbitHealthStatus()) {
        // If rabbitMQ unhealthy, close current connection and try reconnect
        await menash.close();
        await this.initRabbit();
        await mongoWatcher.initWatch();
        sendFailedMsg();
      }

      await sleep(this.healthCheckInterval);
    }
  }

  /**
   * Creates rabbitmq connection.
   * @param {string}  rabbituri - rabbit uri
   */
  async initConnection(rabbituri: string) {
    // Initialize rabbit connection if the conn isn't ready yet
    logger.log(`connecting to rabbitMQ on URI: ${rabbituri} ...`);

    if (!menash.isReady) {
      await menash.connect(rabbituri, { retries: this.rabbitData.rabbitRetries });
      logger.log(`successful connection to rabbitMQ on URI: ${rabbituri}`);
    } else {
      logger.log(`rabbit ${rabbituri} already connected`);
    }
  }

  /**
   * Init rabbitmq queues and exchanges binding
   * @param {QueueObjectType[]} queues - queues array
   */
  async initQueues(queues: QueueObjectType[]) {
    await Promise.all(
      queues.map(async (queue) => {
        if (!(queue.name in menash.queues)) {
          logger.log(`declare queue: ${queue.name}`);
          const queuedeclared = await menash.declareQueue(queue.name, { durable: true });

          if (queue.exchange) {
            if (!(queue.exchange.name in menash.exchanges)) {
              await menash.declareExchange(queue.exchange.name, queue.exchange.type);
            }

            if (menash.bindings.bindings.length < 1) {
              await menash.bind(queue.exchange.name, queuedeclared, queue.exchange.routingKey);
            }
          }
        }
      })
    );
  }
}
