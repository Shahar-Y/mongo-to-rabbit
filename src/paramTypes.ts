import mongoose from 'mongoose';

export type MongoDataType = {
    collectionName: string;
    connectionString: string;
    prettify: boolean;
};

export type RabbitDataType = {
    rabbitURI: string; 
    queueName: string;
}

export type DataObjectType = {
    id: string;
    operation: string;
    fullDocument: object;
    updateDecsctiption: {
        updatedFields: object;
        removedFields: string[];
    };
}