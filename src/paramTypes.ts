import mongoose from 'mongoose';

export type MongoDataType = {
    mongoURI: string;
    replicaSet: string; 
    dbName: string;
    collectionName: string;
    mongoModel: mongoose.Model<mongoose.Document>;
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