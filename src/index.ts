import mongodb from 'mongodb';
import log from './utils/logger';
import { menash } from 'menashmq';
import { ChangeStreamOptions } from 'mongodb';
import { ConnectionStringParser as CSParser, IConnectionStringParameters } from 'connection-string-parser';
import { MongoDataType, RabbitDataType, DataObjectType, MTROptions, middlewareFunc, queueType } from './paramTypes';

const csParser = new CSParser({
    scheme: 'mongodb',
    hosts: []
});

const defaultMiddleware: middlewareFunc = (data: DataObjectType,collection: string ) => {
    return {data, collection};
}

const defaultOptions: MTROptions = {
    silent: true,
    prettify: true
}

const getQueuesNames = (rabbitData: RabbitDataType): string[] =>{
    return [...rabbitData.queues.map(queue => queue.name)]
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
    console.log(`MTR: ===> initiating connection for collection: ${mongoData.collectionName}, and queues: ${getQueuesNames(rabbitData)}`)

    log(`connecting to rabbitMQ on URI: ${rabbitData.rabbitURI} ...`, options);
    // Check if menash already connected to rabbit.
    if (!menash.isReady) {
        await menash.connect(rabbitData.rabbitURI);
        log(`successful connection to rabbitMQ on URI: ${rabbitData.rabbitURI}`, options);
    } else {
        log('rabbit already connected', options);
    }

    await Promise.all(rabbitData.queues.map(async (queue: queueType) => {
        if (queue.middleware !== undefined && !options.prettify) {
            console.log('MTR: ===> error: middleware option cannot work when prettify is false');
        }

        if(!(queue.name in menash.queues)){
         await menash.declareQueue(queue.name, { durable: true });
        }
      
        log(`successful connection to queue ${queue.name}`, options);
    }));

    log(`successful connection to all queues`, options);
    log(`connecting to mongo collection: ${mongoData.collectionName} with connectionString ${mongoData.connectionString} ...`, options);
    initWatch(mongoData, rabbitData.queues, options);
}

/**
 * Initializes the mongo watcher, given the mongo data.
 * @param mongoData - the data about mongo for the connection.
 * @param qName - The name of the queue to publish to.
 * @param options - contains the MTROptions.
 */
function initWatch(mongoData: MongoDataType, queues: queueType[], options: MTROptions) {

    mongodb.MongoClient.connect(mongoData.connectionString, { useUnifiedTopology: true}).then(client => {
        // Select DB and Collection
        const connectionObject: IConnectionStringParameters = csParser.parse(mongoData.connectionString);
        const db = client.db(connectionObject.endpoint);
        const collection = db.collection(mongoData.collectionName);

        // Define change stream
        const pipeline = [{ $match: { 'ns.db': connectionObject.endpoint, 'ns.coll': mongoData.collectionName } }];
        const optionsStream : ChangeStreamOptions = {fullDocument: 'updateLookup'}
        const changeStream = collection.watch(pipeline, optionsStream);
        // start listen to changes
        changeStream.on('change', (event: mongodb.ChangeEvent<Object>) => {
            queues.forEach((queue) => {
                const formattedData = options.prettify ? 
                    queue.middleware == undefined? 
                        defaultMiddleware(prettifyData(event, options), mongoData.collectionName): 
                        queue.middleware(prettifyData(event, options), mongoData.collectionName)
                    : event;
                
                if (formattedData !== null && formattedData !== undefined) {
                    if(Array.isArray(formattedData)){
                        formattedData.forEach(dataContent => menash.send(queue.name, dataContent));
                    }
                    else {
                        menash.send(queue.name, formattedData);
                    }
                }
            });
        });
        console.log(`MTR: ===> successful connection to collection: ${mongoData.collectionName}`);
    });
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
