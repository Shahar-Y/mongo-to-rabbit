import * as amqp from 'amqplib/callback_api';

export var myChannel: amqp.Channel;

export const publishToQueue = async ( qName : string, data: any) => {
    myChannel.sendToQueue(qName, new Buffer(data), {persistent: true});
}

export function connectToQueue(uri: string, qName: string): void {

    amqp.connect(uri, async function (error: Error, connection: amqp.Connection) {
        if(error) {
            // TODO: handle better
            console.log('error detected on amqp.connect!');
            console.log(error);
            throw error;
        }
        console.log('connected to amqp.connect');
        connection.createChannel(function (err: Error, channel: amqp.Channel) {
            if(err){
                console.log('error detected on connection.createChannel!');
                console.log(err);
                throw err;
            }
            myChannel = channel
            console.log(`created channel`);
            // console.log(myChannel);

            myChannel.assertQueue(qName, {
                durable: false
            });
        });
    })
}
