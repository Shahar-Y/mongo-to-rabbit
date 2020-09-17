import mongodb from 'mongodb';
import { MongoDataType, RabbitDataType, DataObjectType, MTROptions } from './paramTypes';
import { menash } from 'menashmq';
import { ConnectionStringParser as CSParser, IConnectionStringParameters } from 'connection-string-parser';
import { log } from './utils/logger';

const csParser = new CSParser({
    scheme: "mongodb",
    hosts: []
});

const defaultOptions : MTROptions = {
    silent: true,
    prettify: true,
}

/**
 * The main function of the package.
 * Creates the listener to mongo and connects it to rabbit.
 * @param mongoData - Information related to mongo.
 * @param rabbitData - Information related to rabbitMQ.
 * @param opts - an optional parameter. defaults to 'defaultOptions'.
 */
export async function watchAndNotify(mongoData: MongoDataType, rabbitData: RabbitDataType, opts?: Partial<MTROptions>) {
    const options : MTROptions = {...defaultOptions, ...opts };

    console.log(`MTR: ===> initiating connection for collection: ${mongoData.collectionName}, and queue: ${rabbitData.queueName}`)
    log(`connecting to rabbitMQ on URI: ${rabbitData.rabbitURI}`, options);
    // Check if menash already connected to rabbit.
    if (!menash.isReady) {
        await menash.connect(rabbitData.rabbitURI);
    } else {
        log(`rabbit already connected`, options);
    }
    await menash.declareQueue(rabbitData.queueName, { durable: true });


    log(`connecting to mongo collection: ${mongoData.collectionName} with connectionString ${mongoData.connectionString}`, options);
    initWatch(mongoData, rabbitData.queueName, options);
}

/**
 * Initializes the mongo watcher, given the mongo data.
 * @param mongoData - the data about mongo for the connection.
 * @param qName - The name of the queue to publish to.
 * @param options - contains the MTROptions.
 */
function initWatch(mongoData: MongoDataType, qName: string, options: MTROptions) {

    mongodb.MongoClient.connect(mongoData.connectionString).then(client => {
        // Select DB and Collection
        const connectionObject: IConnectionStringParameters = csParser.parse(mongoData.connectionString);
        const db = client.db(connectionObject.endpoint);
        const collection = db.collection(mongoData.collectionName);

        // Define change stream
        const pipeline = [{ $match: { 'ns.db': connectionObject.endpoint, 'ns.coll': mongoData.collectionName } }];
        const changeStream = collection.watch(pipeline);
        // start listen to changes
        changeStream.on("change", function (event: mongodb.ChangeEvent<Object>) {
            log(`caught change on collection: ${mongoData.collectionName}`, options);

            const formattedData = options.prettify ? prettifyData(event) : event;
            log(formattedData, options, true);
            menash.send(qName, formattedData);
        });
        console.log(`MTR: ===> successful connection to collection: ${mongoData.collectionName}`);
    });
}

function prettifyData(data: mongodb.ChangeEvent<Object>): DataObjectType {
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
            console.log(`An unknown operation occurred: ${dataObject.operation}`);
    }

    return dataObject;
}
