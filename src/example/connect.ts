
import * as mongoRabbit from '../index';
import { MongoDataType, MTROptions, RabbitDataType } from '../paramTypes';

// Create two colQCouples and connect to two different queues.

const mongoData1: MongoDataType = {
    collectionName: 'files',
    connectionString: 'mongodb://localhost:27017/devDB?replicaSet=rs0',
};
const rabbitData1: RabbitDataType = {
    queueName: 'MyQueueName1',
    rabbitURI: 'amqp://localhost'
};

const options1: Partial<MTROptions> = { silent: false }

const rabbitData2: RabbitDataType = {
    queueName: 'MyQueueName2',
    rabbitURI: 'amqp://localhost'
};
const mongoData2: MongoDataType = {
    collectionName: 'files',
    connectionString: 'mongodb://localhost:27017/devDB?replicaSet=rs0',
};



mongoRabbit.watchAndNotify(mongoData1, rabbitData1, options1);
mongoRabbit.watchAndNotify(mongoData2, rabbitData2);
