import { ExchangeType } from 'menashmq';

export type MongoDataType = {
	collectionName: string;
	connectionString: string;
};

export type RabbitDataType = {
	rabbitURI: string,
	queues: QueueObjectType[];
}

export type DataObjectType = {
	id: string;
	operation: string;
	fullDocument: object;
	updateDescription: {
		updatedFields: object;
		removedFields: string[];
	};
}

export type exchangeObjectType = {
	name: string;
	type: ExchangeType;
	routingKey?: string,
}

export type QueueObjectType = {
	name: string,
	exchange?: exchangeObjectType,
	middleware?: MiddlewareFuncType, 
};

export type sendMsgReq = {
	dest: string | exchangeObjectType;
	msg: any;
}

export type MiddlewareFuncType = 
	(dataObject: DataObjectType, collection?: string) => 
	(null| string | Object | Buffer |string[] | Object[] 
		| Buffer[] | undefined);

export type MTROptions = {
	silent: boolean;
	prettify: boolean;
	rabbitRetries?: number;
}