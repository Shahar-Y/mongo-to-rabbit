import mongodb from 'mongodb';
import { menash } from 'menashmq';
import { ConnectionStringParser as CSParser, IConnectionStringParameters } from 'connection-string-parser';
import { MongoDataType, RabbitDataType, DataObjectType, MTROptions } from './paramTypes';
import log from './utils/logger';

const csParser = new CSParser({
    scheme: 'mongodb',
    hosts: []
});

const defaultOptions: MTROptions = {
    silent: true,
    prettify: true,
    middleware: (data: DataObjectType) => {
        return data;
    }
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
    if (opts?.middleware && !options.prettify) {
        console.log('MTR: ===> error: middleware option cannot work when prettify is false');
        return;
    }

    console.log(`MTR: ===> initiating connection for collection: ${mongoData.collectionName}, and queue: ${rabbitData.queueName}`)
    log(`connecting to rabbitMQ on URI: ${rabbitData.rabbitURI} ...`, options);
    // Check if menash already connected to rabbit.
    if (!menash.isReady) {
        await menash.connect(rabbitData.rabbitURI);
        log(`successful connection to rabbitMQ on URI: ${rabbitData.rabbitURI}`, options);
    } else {
        log('rabbit already connected', options);
    }
    await menash.declareQueue(rabbitData.queueName, { durable: true });
    log(`successful connection to queue ${rabbitData.queueName}`, options);

    log(`connecting to mongo collection: ${mongoData.collectionName} with connectionString ${mongoData.connectionString} ...`, options);
    initWatch(mongoData, rabbitData.queueName, options);
}

/**
 * Initializes the mongo watcher, given the mongo data.
 * @param mongoData - the data about mongo for the connection.
 * @param qName - The name of the queue to publish to.
 * @param options - contains the MTROptions.
 */
function initWatch(mongoData: MongoDataType, qName: string, options: MTROptions) {

    mongodb.MongoClient.connect(mongoData.connectionString, { useUnifiedTopology: true }).then(client => {
        // Select DB and Collection
        const connectionObject: IConnectionStringParameters = csParser.parse(mongoData.connectionString);
        const db = client.db(connectionObject.endpoint);
        const collection = db.collection(mongoData.collectionName);

        // Define change stream
        const pipeline = [{ $match: { 'ns.db': connectionObject.endpoint, 'ns.coll': mongoData.collectionName } }];
        const changeStream = collection.watch(pipeline);
        // start listen to changes
        changeStream.on('change', (event: mongodb.ChangeEvent<Object>) => {
            const formattedData = options.prettify ? options.middleware(prettifyData(event, options)) : event;

            menash.send(qName, formattedData);
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
