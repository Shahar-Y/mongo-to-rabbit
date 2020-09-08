// import mongoose from 'mongoose';
import mongodb from 'mongodb';
import { MongoDataType, RabbitDataType, DataObjectType } from './paramTypes';
import { menash } from 'menashmq';
import { ConnectionStringParser as CSParser, IConnectionStringParameters } from 'connection-string-parser';

const csParser = new CSParser({
    scheme: "mongodb",
    hosts: []
});


// TODO: add options. 
/**
 * The main function of the package.
 * Cteares the listener to mongo and connects it to rabbit.
 * @param mongoData - Information related to mongo.
 * @param rabbitData - Information related to rabbitMQ.
 */
export async function watchAndNotify(mongoData: MongoDataType, rabbitData: RabbitDataType) {
    console.log('connecting to rabbitMQ');
    await menash.connect(rabbitData.rabbitURI);
    await menash.declareQueue(rabbitData.queueName, { durable: true });

    console.log('connecting to mongo');
    const connectionObject: IConnectionStringParameters = csParser.parse(mongoData.connectionString);
    const pipeline = [{ $match: { 'ns.db': connectionObject.endpoint, 'ns.coll': mongoData.collectionName } }];
    initWatch(mongoData, connectionObject, rabbitData.queueName, pipeline, mongoData.prettify);
}

/**
 * Initializes the mongo watcher, given the mongo data.
 * @param model - the mongoose model.
 * @param pipeline - contains the db name and collection name.
 * @param qName - The name of the queue to publish to.
 * @param prettify - boolean, wheather or not to prettify the information sent.
 */
function initWatch(mongoData: MongoDataType, connectionObject: IConnectionStringParameters, qName: string, pipeline: any = [], prettify: boolean) {
    mongodb.MongoClient.connect(mongoData.connectionString).then(client => {
        console.log("Connected to MongoDB server");
        // Select DB and Collection
        const db = client.db(connectionObject.endpoint);
        const collection = db.collection(mongoData.collectionName);

        // Define change stream
        const changeStream = collection.watch(pipeline);
        // start listen to changes
        changeStream.on("change", function (event: mongodb.ChangeEvent<Object>) {

            const formattedData = prettify ? prettifyData(event) : event;
            menash.send(qName, formattedData);
        });
    });
    console.log('finished initWatch');
}

function prettifyData(data: mongodb.ChangeEvent<Object>): DataObjectType {
    // Create the basic dataObject
    const dataObject: DataObjectType = { id: 'null', operation: 'unknown', fullDocument: {}, updateDecsctiption: { updatedFields: {}, removedFields: [] } };

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
            dataObject.updateDecsctiption = (<any>data).updateDescription;
            break;
        case 'delete':
            break;
        default:
            console.log(`An unknown operation occured: ${dataObject.operation}`);
    }

    return dataObject;
}
