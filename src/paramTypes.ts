export type MongoDataType = {
	collectionName: string;
	connectionString: string;
};

export type RabbitDataType = {
	rabbitURI: string;
	queueName: string;
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

export type MTROptions = {
	silent: boolean;
	prettify: boolean;
	middleware: (datqaObject: DataObjectType) => (string | Object | Buffer);
}
