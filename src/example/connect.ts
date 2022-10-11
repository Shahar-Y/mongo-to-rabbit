import { watchAndNotify } from '../index';
import {
  MongoDataType,
  MTROptions,
  RabbitDataType,
  DataObjectType,
  MiddlewareFuncType,
} from '../paramTypes';

// Create two colQCouples and connect to two different queues.

const mongoDBUrl =
  'mongodb://localhost:27017,localhost:27018,localhost:27019/devDB?replicaSet=rs0';

// First colQCouple
const middleware1: MiddlewareFuncType = (x: DataObjectType) => {
  const x2: DataObjectType = x;
  x2.operation += '!!!';
  return x;
};

const mongoData1: MongoDataType = {
  collectionName: 'files',
  connectionString: mongoDBUrl,
};
const rabbitData1: RabbitDataType = {
  queues: [
    { name: 'MyQueueName1', middleware: middleware1 },
    { name: 'MyQueueName2' },
  ],
  rabbitURI: 'amqp://localhost',
};

const options1: Partial<MTROptions> = { silent: false };

// Second colQCouple
const mongoData2: MongoDataType = {
  collectionName: 'permissions',
  connectionString: mongoDBUrl,
};

const rabbitData2: RabbitDataType = {
  queues: [{ name: 'MyQueueName2' }],
  rabbitURI: 'amqp://localhost',
};

console.log('Activating watchAndNotify for the first colQCouple');
watchAndNotify(mongoData1, rabbitData1, options1);

console.log('Activating watchAndNotify for the second colQCouple');
watchAndNotify(mongoData2, rabbitData2);
