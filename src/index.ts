import mongoose from 'mongoose';
import mongodb from 'mongodb';

export function add(n1: number, n2: number): number {
    return n1 + n2 + 1;
}

// TODO: add options. 
export async function watchAndNotify(mongoURI: string, replicaSet: string, dbName: string, collectionName: string, model: mongoose.Model<mongoose.Document, {}>, rabbitURI: string) {
    connectToMongo(mongoURI, dbName, replicaSet);
    const pipeline = [{ $match: { 'ns.db': dbName, 'ns.coll': collectionName } }];
    model.watch(pipeline).on('change', async(data :mongodb.ChangeEvent<Object>) => {
        if(!data) return;
        data.operationType
        let operation : string = data.operationType || 'unknown';
        let dataString : string = 'NO_DATA';
        switch(operation) {
            case 'insert':
                dataString = JSON.stringify((<any>data).fullDocument);
                break;
            case 'replace':
                // dataString = JSON.stringify((<any>data).fullDocument);
                break;
            case 'update':
                dataString = JSON.stringify((<any>data).updateDescription);
                break;
            case 'delete':
                // dataString = JSON.stringify((<any>data).fullDocument);
                break;
            case 'rename':
                // dataString = JSON.stringify((<any>data).fullDocument);
                break;
            case 'drop':
                // dataString = JSON.stringify((<any>data).fullDocument);
                break;
            case 'dropDatabase':
                // dataString = JSON.stringify((<any>data).fullDocument);
                break;
            case 'invalidate':
                // dataString = JSON.stringify((<any>data).fullDocument);
                break;
            default:
                console.log(`an unknown operation occured: ${operation}`);
        }

        // send.publishToQueue(send.queueName, `operation: ${operation}, dataString: ${dataString}`);

    });

    return null;
}


async function connectToMongo(mongoURI: string, dbName: string, replicaSet: string) {
    // Connect to the replica set
    // TODO: username and password - ?
    await mongoose.connect(`${mongoURI}/${dbName}?replicaSet=${replicaSet}`, { useNewUrlParser: true });


}