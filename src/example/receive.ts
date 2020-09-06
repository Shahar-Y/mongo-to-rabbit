import * as amqp from 'amqplib/callback_api';


amqp.connect('amqp://localhost', function (error0: Error, connection: amqp.Connection) {
    if (error0) {
        console.log('error detected on amqp.connect!');
        console.log(error0);
        throw error0;
    }
    console.log('connected to amqp.connect');

    connection.createChannel(function (error1: Error, channel: amqp.Channel) {
        if (error1) {
            console.log('error detected on connection.createChannel!');
            console.log(error1);
            throw error1;
        }
        console.log('createChannel finished!');

        var queue = 'myQueueName';
        channel.assertQueue(queue, {
            durable: false
        });
        console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", queue);
        channel.consume(queue, function (msg) {
            if(!msg) {
                console.log('BAD MESSAGE');
                return;
            }
            console.log(" [x] Received %s", msg.content.toString());
        }, {
            noAck: true
        });
    });
});



