
import * as mongoRabbit from '../index';
import { MongoDataType, RabbitDataType } from '../paramTypes';
import { ConnectionStringParser as CSParser } from 'connection-string-parser';

const csParser = new CSParser({
    scheme: "mongodb",
    hosts: []
});

var mongoData: MongoDataType = {
    collectionName: 'files',
    connectionString: 'mongodb://localhost:27017/devDB?replicaSet=rs0',
    prettify: true
};
var rabbitData: RabbitDataType = {
    queueName: 'MyQueueName1',
    rabbitURI: 'amqp://localhost'
};

var rabbitData2: RabbitDataType = {
    queueName: 'MyQueueName2',
    rabbitURI: 'amqp://localhost'
};
let mongoData2: MongoDataType = {
    collectionName: 'files',
    connectionString: 'mongodb://localhost:27017/devDB?replicaSet=rs0',
    prettify: false
};

mongoRabbit.watchAndNotify(mongoData, rabbitData);
mongoRabbit.watchAndNotify(mongoData2, rabbitData2);
