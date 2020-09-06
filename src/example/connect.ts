import { Schema, model } from 'mongoose';
import * as mongoRabbit from '../index';
import { MongoDataType, RabbitDataType } from '../paramTypes';


const collectionName: string = 'files';
const fileSchema: Schema = new Schema(
    {
        key: {
        type: String,
        },
        name: {
        type: String,
        required: true,
        }
    },
    );

const fileModel = model(collectionName, fileSchema);

var mongoData: MongoDataType = {
    collectionName,
    mongoURI: 'mongodb://localhost:27017',
    mongoModel: fileModel,
    dbName: 'devDB',
    replicaSet: 'rs0',
    prettify: true
};

var rabbitData: RabbitDataType = {
    queueName: 'myQueueName',
    rabbitURI: 'amqp://localhost'
};

var rabbitData2: RabbitDataType = {
    queueName: 'myQueueName2',
    rabbitURI: 'amqp://localhost'
};
let mongoData2 = {
    collectionName,
    mongoURI: 'mongodb://localhost:27017',
    mongoModel: fileModel,
    dbName: 'devDB',
    replicaSet: 'rs0',
    prettify: false
};


mongoRabbit.watchAndNotify(mongoData, rabbitData);
mongoRabbit.watchAndNotify(mongoData2, rabbitData2);
