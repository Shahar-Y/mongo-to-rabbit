export type MongoDataType = {
	collectionName: string;
	connectionString: string;
};

export type RabbitDataType = {
	rabbitURI: string,
	queues: queueObjectType[];
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

export type queueObjectType = {
	name: string,
	middleware?: middlewareFunc, 
};

export type middlewareFunc = 
	(dataObject: DataObjectType, collection: string) => 
	(null| string | Object | Buffer |string[] | Object[] 
		| Buffer[] | undefined);

export type MTROptions = {
	silent: boolean;
	prettify: boolean;
	retries?: number;
}