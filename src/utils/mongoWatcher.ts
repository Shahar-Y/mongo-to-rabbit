import mongoose, { ConnectOptions } from 'mongoose';
import { logger, sleep } from '../index';
import { formatMsg } from './message';
import { ChangeStreamOptions, ChangeEvent, ResumeToken } from 'mongodb';
import { MongoDataType, MTROptions, RabbitDataType } from '../paramTypes';
import { changeStreamTrackerModel } from '../models/changeStreamModel';
import { ConnectionStringParser as CSParser, IConnectionStringParameters } from 'connection-string-parser';
import { collectionModel } from '../models/collectionModel';

// Global variables
const mongoOptions: ConnectOptions = {
  useNewUrlParser: true,
  useFindAndModify: false,
  useCreateIndex: true,
  useUnifiedTopology: true,
};
const csParser = new CSParser({ scheme: 'mongodb', hosts: [] });

/**
 * Get mongo connection health status
 * @returns {boolean} isHealthy - true if healthy
 */
export function getMongoHealthStatus(): boolean {
  return mongoose.connection.readyState === 1;
}

export class MongoWatcher {
  mongoData: MongoDataType;
  rabbitData: RabbitDataType;
  options: MTROptions;
  healthCheckInterval: number = 30000;

  /**
   * Creates MongoWatcher instance
   * @param {MongoDataType}   mongoData   - mongo uri and collection name
   * @param {RabbitDataType}  rabbitData  - rabbit data
   * @param {MTROptions}      options     - mongo to rabbit options
   */
  constructor(mongoData: MongoDataType, rabbitData: RabbitDataType, options: MTROptions) {
    this.mongoData = mongoData;
    this.rabbitData = rabbitData;
    this.options = options;
    if (mongoData.healthCheckInterval) this.healthCheckInterval = mongoData.healthCheckInterval;
  }

  /**
   * Starts mongo connection
   */
  async mongoConnection() {
    while (true) {
      try {
        logger.log(
          `try connect mongo collection: ${this.mongoData.collectionName}, uri: ${this.mongoData.connectionString}`
        );
        await mongoose.connect(this.mongoData.connectionString, mongoOptions);
        logger.log(`successful connection to mongo on connectionString: ${this.mongoData.connectionString}`);

        this.initWatch();
        break;
      } catch (error) {
        console.log(`can't connect to mongo. Retrying in ${this.healthCheckInterval}ms`);
        console.log(error);

        await sleep(this.healthCheckInterval);
      }
    }
  }

  /**
   * Initiate collection watcher change stream from last event id. if none found, returns undefiend
   * @param {String} collectionName - collection name that the mongo watches
   */
  async initiateChangeStreamStartTime(collectionName: string) {
    // Get the last event
    const latestEvent: any = await changeStreamTrackerModel(collectionName).findOne({}).sort({ createdAt: -1 });
    const latestEventId = latestEvent && latestEvent.eventId;

    return latestEventId;
  }

  /**
   * Initializes the mongo watcher, given the mongo data.
   */
  async initWatch() {
    // Get the last event id that successfully sent to rabbit
    const lastEventId = await this.initiateChangeStreamStartTime(this.mongoData.collectionName);

    // Select DB and Collection
    const connectionObject: IConnectionStringParameters = csParser.parse(this.mongoData.connectionString);
    const collection = collectionModel(this.mongoData.collectionName);

    // Define collection change stream settings
    const pipeline = [{ $match: { 'ns.db': connectionObject.endpoint, 'ns.coll': this.mongoData.collectionName } }];
    const optionsStream: ChangeStreamOptions = { fullDocument: 'updateLookup' };

    if (lastEventId) {
      const startAfterToken: ResumeToken = {};
      (startAfterToken as any)['_data'] = lastEventId;
      optionsStream.startAfter = startAfterToken;
    }

    const changeStream = collection.watch(pipeline, optionsStream);

    // start listen to changes
    changeStream
      .on('change', async (event: ChangeEvent<any>) => {
        logger.log(`got mongo event: ${event.operationType}, at collection:${this.mongoData.collectionName}`);

        try {
          // Try send msg to all queues
          await Promise.all(
            this.rabbitData.queues.map(async (queue) => await formatMsg(queue, this.options, event, this.mongoData))
          );

          const eventId = (event._id as any)['_data'];
          // Update event stream document
          changeStreamTrackerModel(this.mongoData.collectionName).create(
            { eventId: eventId, description: event },
            async (err: any) => {
              err
                ? console.log('err in create event time', err)
                : await changeStreamTrackerModel(this.mongoData.collectionName).deleteMany({
                    eventId: { $ne: eventId },
                  });
            }
          );
        } catch (error) {
          console.log('something went wrong in rabbit send msg', error);
        }
      })
      .on('error', async (err: any) => {
        console.log(`error in mongo`);
        console.log(err);
        this.mongoConnection();
      });

    logger.log(`MTR: ===> successful connection to collection: ${this.mongoData.collectionName}`);
  }
}
