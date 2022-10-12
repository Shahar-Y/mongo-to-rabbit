import mongoose, { ConnectOptions } from 'mongoose';
import { ChangeStreamOptions, ChangeEvent, ResumeToken } from 'mongodb';
import {
  ConnectionStringParser as CSParser,
  IConnectionStringParameters,
} from 'connection-string-parser';
import sleep from './general';
import changeStreamTrackerModel from '../models/changeStreamModel';
import collectionModel from '../models/collectionModel';
import { logger } from '../index';
import { formatAndSendMsg } from './message';
import { MongoDataType, MTROptions, RabbitDataType } from '../paramTypes';
import { criticalLog } from './logger';

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

  healthCheckInterval = 30000;

  /**
   * Creates MongoWatcher instance
   * @param {MongoDataType}   mongoData   - mongo uri and collection name
   * @param {RabbitDataType}  rabbitData  - rabbit data
   * @param {MTROptions}      options     - mongo to rabbit options
   */
  constructor(
    mongoData: MongoDataType,
    rabbitData: RabbitDataType,
    options: MTROptions
  ) {
    this.mongoData = mongoData;
    this.rabbitData = rabbitData;
    this.options = options;
    if (mongoData.healthCheckInterval)
      this.healthCheckInterval = mongoData.healthCheckInterval;
  }

  /**
   * Starts mongo connection, monitoring the database and initializing the watcher.
   */
  async mongoConnection(): Promise<void> {
    while (true) {
      try {
        logger.log(
          `try connect mongo collection: ${this.mongoData.collectionName}, uri: ${this.mongoData.connectionString}`
        );
        await mongoose.connect(this.mongoData.connectionString, mongoOptions);
        logger.log(
          `successful connection to mongo on connectionString: ${this.mongoData.connectionString}`
        );

        this.initWatch();
        break;
      } catch (error) {
        criticalLog(
          `can't connect to mongo. Retrying in ${this.healthCheckInterval}ms`
        );
        criticalLog(error);

        await sleep(this.healthCheckInterval);
      }
    }
  }

  /**
   * Initiate collection watcher change stream from last event id.
   * Returns undefiend if none found or if allowTracker is false.
   */
  async initiateChangeStreamStartTime(): Promise<any> {
    // Get the last event
    if (this.options.allowTracker) {
      const latestEvent: any = await changeStreamTrackerModel(
        this.mongoData.collectionName
      )
        .findOne({})
        .sort({ createdAt: -1 });
      const latestEventId = latestEvent && latestEvent.eventId;

      return latestEventId;
    }

    return undefined;
  }

  /**
   * Initializes the mongo watcher, given the mongo data.
   */
  async initWatch(): Promise<void> {
    // Get the last event id that successfully sent to rabbit.
    const lastEventId = await this.initiateChangeStreamStartTime();

    // Select DB and Collection
    const connectionObject: IConnectionStringParameters = csParser.parse(
      this.mongoData.connectionString
    );
    const collection = collectionModel(this.mongoData.collectionName);

    // Define collection change stream settings
    const pipeline = [
      {
        $match: {
          'ns.db': connectionObject.endpoint,
          'ns.coll': this.mongoData.collectionName,
        },
      },
    ];
    const optionsStream: ChangeStreamOptions = { fullDocument: 'updateLookup' };

    if (lastEventId) {
      const startAfterToken: ResumeToken = {};
      (startAfterToken as any)._data = lastEventId;
      optionsStream.startAfter = startAfterToken;
    }

    const changeStream = collection.watch(pipeline, optionsStream);

    // start listen to changes
    changeStream
      .on('change', async (event: ChangeEvent<any>) => {
        logger.log(
          `got mongo event: ${event.operationType}, at collection:${this.mongoData.collectionName}`
        );

        try {
          // Try send msg to all queues
          await Promise.all(
            this.rabbitData.queues.map(async (queue) =>
              formatAndSendMsg(queue, this.options, event, this.mongoData)
            )
          );

          // Update tracker
          if (this.options.allowTracker) {
            this.updateTracker(event);
          }
        } catch (error) {
          criticalLog(`something went wrong in rabbit send msg ${error}`);
        }
      })
      .on('error', async (err: any) => {
        criticalLog('error in mongo');
        criticalLog(err);
        this.mongoConnection();
      });

    logger.log(
      `MTR: ===> successful connection to collection: ${this.mongoData.collectionName}`
    );
  }

  /**
   * Updates the tracker with the last event id.
   * @param event - the last event.
   */
  async updateTracker(event: ChangeEvent<any>) {
    const eventId = (event._id as any)._data;
    // Update event stream document
    changeStreamTrackerModel(this.mongoData.collectionName).findOneAndUpdate(
      { eventId },
      { eventId, description: event },
      { upsert: true },
      async (err: any) => {
        if (err) criticalLog(`err in create event time ${err}`);
        else {
          try {
            await changeStreamTrackerModel(this.mongoData.collectionName);
          } catch (error) {
            criticalLog(
              `cant remove before events in collection ${this.mongoData.collectionName}, err: ${error}`
            );
          }
        }
      }
    );
  }
}
