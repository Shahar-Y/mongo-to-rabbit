import mongodb, { Timestamp, ChangeStreamOptions, MongoClient, ChangeEvent } from 'mongodb';
import log from './utils/logger';
import { menash } from 'menashmq';
import { ConnectionStringParser as CSParser, IConnectionStringParameters } from 'connection-string-parser';
import { changeStreamTrackerModel } from './changeStreamModel';
import { MongoDataType, RabbitDataType, DataObjectType, MTROptions, MiddlewareFuncType, QueueObjectType } from './paramTypes';

let mongoConn: MongoClient;
const millisecondConvertNumber: number = 1000;
const eventTtl: number = 3600;

const csParser = new CSParser({ scheme: 'mongodb', hosts: [] });
const defaultOptions: MTROptions = { silent: true, prettify: true };

const defaultMiddleware: MiddlewareFuncType = (data: DataObjectType) => {
    return data;
};

/**
 * The main function of the package.
 * Creates the listener to mongo and connects it to rabbit.
 * @param {MongoDataType}   mongoData - Information related to mongo.
 * @param {RabbitDataType}  rabbitData - Information related to rabbitMQ.
 * @param {MTROptions}      opts - an optional parameter. defaults to 'defaultOptions'.
 */
export default async function watchAndNotify(mongoData: MongoDataType, rabbitData: RabbitDataType, opts?: Partial<MTROptions>): Promise<void> {
    const options: MTROptions = { ...defaultOptions, ...opts };
    rabbitData.queues.forEach((queue) => {
        if (!options.prettify && queue.middleware !== undefined) {
            console.log('MTR: ===> error: middleware option cannot work when prettify is false');
            return;
        }
    });

    await initRabbitConn(rabbitData.rabbitURI, options);
    await initQueues(rabbitData.queues);

    log(`successful connection to all queues`, options);
    log(`connecting to mongo collection: ${mongoData.collectionName} with connectionString ${mongoData.connectionString} ...`, options);

    mongoConn = new MongoClient(mongoData.connectionString, { useUnifiedTopology: true });
    mongoConnection(mongoData, rabbitData, options);
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get rabbit health status
 * @returns {boolean} isHealthy - true if healthy
 */
export function getRabbitHealthStatus(): boolean {
    return !menash.isClosed && menash.isReady;
}

/**
 * Get mongo connection health status
 * @returns {boolean} isHealthy - true if healthy
 */
export function getMongoHealthStatus(): boolean {
    return mongoConn.isConnected();
}

/**
 * Start mongo connection
 * @param {MongoDataType}   mongoData   - mongo uri and collection name
 * @param {RabbitDataType}  rabbitData  - rabbit data
 * @param {MTROptions}      options     - mongo to rabbit options
 */
async function mongoConnection(mongoData: MongoDataType, rabbitData: RabbitDataType, options: MTROptions) {
    const reconnectSleepTime: number = 1000;

    while (true) {
        try {
            log('try connect to mongo', options);
            await mongoConn.connect();
            log(`successful connection to mongo on connectionString: ${mongoData.connectionString}`, options);

            const startTime = await initiateChangeStreamStartTime(mongoData.collectionName);
            initWatch(mongoData, rabbitData, options, startTime);
            break;
        } catch (error) {
            console.log(`cant connect to mongo. Retrying in ${reconnectSleepTime}`);
            console.log(error);
            await sleep(reconnectSleepTime);
        }
    }
}

/**
 * Creates rabbitmq connection.
 * @param {string}      rabbituri   - rabbit uri
 * @param {MTROptions}  options     - contains the MTROptions.
 */
async function initRabbitConn(rabbituri: string, options: MTROptions) {
    // Initialize rabbit connection if the conn isn't ready yet
    log(`connecting to rabbitMQ on URI: ${rabbituri} ...`, options);

    if (!menash.isReady) {
        await menash.connect(rabbituri, { retries: options.rabbitRetries });
        log(`successful connection to rabbitMQ on URI: ${rabbituri}`, options);
    } else {
        log(`rabbit ${rabbituri} already connected`, options);
    }
}

/**
 * Init rabbitmq queues and exchanges binding
 * @param {QueueObjectType[]} queues - queues array
 */
async function initQueues(queues: QueueObjectType[]) {
    await Promise.all(
        queues.map(async (queue) => {
            if (!(queue.name in menash.queues)) {
                console.log(`declare queue: ${queue.name}`);
                const queuedeclared = await menash.declareQueue(queue.name, { durable: true });

                if (queue.exchange) {
                    if (!(queue.exchange.name in menash.exchanges)) await menash.declareExchange(queue.exchange.name, queue.exchange.type);
                    await menash.bind(queue.exchange.name, queuedeclared, queue.exchange.routingKey);
                }
            }
        })
    );
}

/**
 * Initiate stream from last event
 */
async function initiateChangeStreamStartTime(collectionName: string) {
    const latestEvent = await changeStreamTrackerModel(collectionName).findOne({}).sort({ timeStamp: -1 });
    const latestEventTime = latestEvent
        ? new Timestamp(1, latestEvent.timeStamp * millisecondConvertNumber)
        : new Timestamp(1, new Date().getTime() / millisecondConvertNumber - eventTtl);

    return latestEventTime;
}

/**
 * Initializes the mongo watcher, given the mongo data.
 * @param {MongoDataType}   mongoData   - the data about mongo for the connection.
 * @param {RabbitDataType}  rabbitData  - the data about rabbit connection
 * @param {MTROptions}      options     - contains the MTROptions.
 * @param {Timestamp}       startTime   - optional starttime listener
 */
async function initWatch(mongoData: MongoDataType, rabbitData: RabbitDataType, options: MTROptions, startTime?: Timestamp) {
    // Select DB and Collection
    const connectionObject: IConnectionStringParameters = csParser.parse(mongoData.connectionString);
    const db = mongoConn.db(connectionObject.endpoint);
    const collection = db.collection(mongoData.collectionName);

    // Define change stream settings
    const pipeline = [{ $match: { 'ns.db': connectionObject.endpoint, 'ns.coll': mongoData.collectionName } }];

    const optionsStream: ChangeStreamOptions = { fullDocument: 'updateLookup' };
    if (startTime) optionsStream.startAtOperationTime = startTime;

    const changeStream = collection.watch(pipeline, optionsStream);

    // start listen to changes
    changeStream
        .on('change', (event: ChangeEvent) => {
            log(`got mongo change event:  ${event.operationType} in collection:${mongoData.collectionName}`, options);

            // Update event stream d
            changeStreamTrackerModel(mongoData.collectionName).create(
                {
                    eventId: event._id,
                    timeStamp: Number(event.clusterTime) * millisecondConvertNumber,
                    description: event,
                },
                async (err: any) => {
                    if (err) console.log('err in create event time', err);
                    else {
                        rabbitData.queues.forEach((queue) => formatMsg(queue, options, event, mongoData));
                    }
                }
            );
        })
        .on('error', async (err: any) => {
            console.log(`error in mongo`);
            console.log(err);
            mongoConnection(mongoData, rabbitData, options);
        });

    console.log(`MTR: ===> successful connection to collection: ${mongoData.collectionName}`);
}

/**
 * formatMsg - parse msg and send it to queue
 * @param {QueueObjectType}             queue     - queue object
 * @param {MTROptions}                  options   - options for package
 * @param {mongodb.ChangeEvent<Object>} event     - mongo change event
 * @param {MongoDataType}               mongoData - mongoData options
 */
function formatMsg(queue: QueueObjectType, options: MTROptions, event: mongodb.ChangeEvent<Object>, mongoData: MongoDataType) {
    const formattedData = options.prettify
        ? queue.middleware == undefined
            ? defaultMiddleware(prettifyData(event, options), mongoData.collectionName)
            : queue.middleware(prettifyData(event, options), mongoData.collectionName)
        : event;

    if (formattedData !== null && formattedData !== undefined) {
        Array.isArray(formattedData) ? formattedData.forEach((dataContent) => sendMsg(queue, dataContent)) : sendMsg(queue, formattedData);
    }
}
/**
 * sendMsg function to queue - by exchange or direct queue
 * @param {QueueObjectType} queue   - queue object
 * @param {any}             msg     - formatted msg
 */
export function sendMsg(queue: QueueObjectType, msg: any) {
    queue.exchange ? menash.send(queue.exchange.name, msg, {}, queue.exchange.routingKey) : menash.send(queue.name, msg);
}

/**
 * prettifyData formats the data sent from the change event on mongo.
 * @param {mongodb.ChangeEvent<Object>} data    - the information sent from mongo about the change.
 * @param {MTROptions}                  options - options for package
 * @returns an object of type DataObjectType.
 */
function prettifyData(data: mongodb.ChangeEvent<Object>, options: MTROptions): DataObjectType {
    // Create the basic dataObject
    const dataObject: DataObjectType = {
        id: 'null',
        operation: 'unknown',
        fullDocument: {},
        updateDescription: { updatedFields: {}, removedFields: [] },
    };

    if (!data) {
        return dataObject;
    }

    dataObject.operation = data.operationType || 'unknown';
    if ((<any>data).documentKey) {
        dataObject.id = (<any>data).documentKey._id;
    }

    switch (dataObject.operation) {
        case 'insert':
            dataObject.fullDocument = (<any>data).fullDocument;
            break;
        case 'replace':
            dataObject.fullDocument = (<any>data).fullDocument;
            break;
        case 'update':
            dataObject.fullDocument = (<any>data).fullDocument;
            dataObject.updateDescription = (<any>data).updateDescription;
            break;
        case 'delete':
            break;
        default:
            log(`An unknown operation occurred: ${dataObject.operation}`, options);
    }

    return dataObject;
}
