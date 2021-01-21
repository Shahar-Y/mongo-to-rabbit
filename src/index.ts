import mongodb from 'mongodb';
import log from './utils/logger';
import { MongoDataType,
         RabbitDataType,
         DataObjectType,
         MTROptions,
         middlewareFunc, 
         queueObjectType} from './paramTypes';
import { ConnectionStringParser as CSParser,
         IConnectionStringParameters } from 'connection-string-parser';
import {menash} from 'menashmq';
import { ChangeStreamOptions } from 'mongodb';
import { MongoClient } from 'mongodb';

let mongoConn: MongoClient;
const csParser = new CSParser({
    scheme: 'mongodb',
    hosts: []
});

const defaultMiddleware: middlewareFunc = (data: DataObjectType,collection: string ) => {
    return {data, collection};
}

const defaultOptions: MTROptions = {
    silent: true,
    prettify: true,
}

const getQueuesNames = (queues: queueObjectType[]): string[] =>{
    return [...queues.map(queue => queue.name)]
}

/**
 * The main function of the package.
 * Creates the listener to mongo and connects it to rabbit.
 * @param mongoData - Information related to mongo.
 * @param rabbitData - Information related to rabbitMQ.
 * @param opts - an optional parameter. defaults to 'defaultOptions'.
 */
export default async function watchAndNotify(mongoData: MongoDataType, rabbitData: RabbitDataType, opts?: Partial<MTROptions>): Promise<void> {
    const options: MTROptions = { ...defaultOptions, ...opts };
    rabbitData.queues.forEach(queue => {
        if (!options.prettify && queue.middleware !== undefined) {
            console.log('MTR: ===> error: middleware option cannot work when prettify is false');
            return;
        }
    })

    await initRabbitConn(rabbitData.rabbitURI, options);
    await initQueues(getQueuesNames(rabbitData.queues));

    log(`successful connection to all queues`, options);
    log(`connecting to mongo collection: ${mongoData.collectionName} with connectionString ${mongoData.connectionString} ...`, options);
    
    mongoConn = new MongoClient(mongoData.connectionString, {useUnifiedTopology: true});
    mongoConnection(mongoData, rabbitData, options);
}

/**
 * Get rabbit health status
 * @returns boolean - true if rabbit is healthy
 */
export function getRabbitHealthStatus(): boolean{
    return !menash.isClosed && menash.isReady;
}

/**
 * Get mongo connection health status
 * @returns boolean - true if mongo is healthy
 */
export function getMongoHealthStatus(): boolean {
    return mongoConn.isConnected();
}

/**
 * Creates mongodb connection.
 * @param mongoData  - mongo data - collections and connection uri (MongoDataType)
 * @param rabbitData - rabbit data (RabbitDataType)
 * @param options    - contains the MTROptions.
 */
async function mongoConnection(mongoData: MongoDataType, rabbitData: RabbitDataType, options: MTROptions) {
    let isConnectOnce: boolean = false;

    while(!isConnectOnce) {
        try {
            log('try connect to mongo', options);
            await mongoConn.connect();

            log(`successful connection to mongo on connectionString: ${mongoData.connectionString}`, options);
            isConnectOnce = true;
            initWatch(mongoData,rabbitData, options);
        } catch(error) {
            log('cant connect to mongo', options);
            await sleep(10000);
        }
    }
}

/**
 * Creates rabbitmq connection.
 * @param rabbituri - rabbit uri (string)
 * @param options - contains the MTROptions.
 */
async function initRabbitConn(rabbituri: string, options: MTROptions) {
    // Initialize rabbit connection if the conn isn't ready yet
    log(`connecting to rabbitMQ on URI: ${rabbituri} ...`, options);

    if (!menash.isReady) {
        await menash.connect(rabbituri, (options.retries ? { retries: options.retries } : {}));
        log(`successful connection to rabbitMQ on URI: ${rabbituri}`, options);
    } else {
        log(`rabbit ${rabbituri} already connected`, options);
    }
}

/**
 * Init rabbitmq queues.
 * @param queues - names of the queues (string[])
 */
async function initQueues(queues: string[]) {
    await Promise.all(queues.map(async (queueName) => {
        if(!(queueName in menash.queues)) {
            console.log(`declare queue: ${queueName}`);
            await menash.declareQueue(queueName, { durable: true });
        }
    }));
}

/**
 * Initializes the mongo watcher, given the mongo data.
 * @param mongoData - the data about mongo for the connection.
 * @param qName - The name of the queue to publish to.
 * @param options - contains the MTROptions.
 */
async function initWatch(mongoData: MongoDataType, rabbitData: RabbitDataType, options: MTROptions) {    
    // Select DB and Collection
    const connectionObject: IConnectionStringParameters = csParser.parse(mongoData.connectionString);
    const db = mongoConn.db(connectionObject.endpoint);
    const collection = db.collection(mongoData.collectionName);

    // Define change stream
    const pipeline = [{ $match: { 'ns.db': connectionObject.endpoint, 'ns.coll': mongoData.collectionName } }];
    const optionsStream : ChangeStreamOptions = {fullDocument: 'updateLookup'}
    const changeStream = collection.watch(pipeline, optionsStream);

    // start listen to changes
    changeStream.on('change', (event: mongodb.ChangeEvent<Object>) => {
        rabbitData.queues.forEach((queue) => {
            const formattedData = options.prettify ? 
                queue.middleware == undefined? 
                    defaultMiddleware(prettifyData(event, options), mongoData.collectionName): 
                    queue.middleware(prettifyData(event, options), mongoData.collectionName)
                : event;
            
            if (formattedData !== null && formattedData !== undefined) {
                if(Array.isArray(formattedData)){
                    formattedData.forEach(dataContent => 
                        menash.send(queue.name, dataContent));
                }
                else {
                    menash.send(queue.name, formattedData);
                }
            }
        });
    }).on('error', async(err) => {
        log(`error in mongo`, options);
        log(err, options);
        mongoConnection(mongoData, rabbitData, options);
    });

    console.log(`MTR: ===> successful connection to collection: ${mongoData.collectionName}`);
}

/**
 * prettifyData formats the data sent from the change event on mongo.
 * @param data - the information sent from mongo about the change.
 * @returns an object of type DataObjectType.
 */
function prettifyData(data: mongodb.ChangeEvent<Object>, options: MTROptions): DataObjectType {
    // Create the basic dataObject
    const dataObject: DataObjectType = { id: 'null', operation: 'unknown', fullDocument: {}, updateDescription: { updatedFields: {}, removedFields: [] } };

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
            dataObject.fullDocument = (<any>data).fullDocument
            dataObject.updateDescription = (<any>data).updateDescription;
            break;
        case 'delete':
            break;
        default:
            log(`An unknown operation occurred: ${dataObject.operation}`, options);
    }

    return dataObject;
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}