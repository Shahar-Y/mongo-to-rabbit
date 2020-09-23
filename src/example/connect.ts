
import watchAndNotify from '../index';
import { MongoDataType, MTROptions, RabbitDataType, DataObjectType } from '../paramTypes';

// Create two colQCouples and connect to two different queues.

// First colQCouple
const mongoData1: MongoDataType = {
	collectionName: 'files',
	connectionString: 'mongodb://localhost:27017/devDB?replicaSet=rs0',
};
const rabbitData1: RabbitDataType = {
	queueName: 'MyQueueName1',
	rabbitURI: 'amqp://localhost'
};

const options1: Partial<MTROptions> =
{
	silent: false,
	middleware: (x: DataObjectType) => {
		const x2: DataObjectType = x;
		x2.operation += '!!!';
		return x;
	},
}

// Second colQCouple
const mongoData2: MongoDataType = {
	collectionName: 'files',
	connectionString: 'mongodb://localhost:27017/devDB?replicaSet=rs0',
};

const rabbitData2: RabbitDataType = {
	queueName: 'MyQueueName2',
	rabbitURI: 'amqp://localhost'
};

watchAndNotify(mongoData1, rabbitData1, options1);
watchAndNotify(mongoData2, rabbitData2);
