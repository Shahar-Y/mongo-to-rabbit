
import * as amqp from 'amqplib/callback_api';

connectReceiver('R1', 'MyQueueName1');
connectReceiver('R2', 'MyQueueName2');

function connectReceiver(receiverName: string, queueName: string) {
  amqp.connect('amqp://localhost', (error0: Error, connection: amqp.Connection) => {
    if (error0) {
      console.log('error detected on amqp.connect!');
      console.log(error0);
      throw error0;
    }
    console.log(`(${receiverName}) : connected to amqp.connect`);

    connection.createChannel((error1: Error, channel: amqp.Channel) => {
      if (error1) {
        console.log('error detected on connection.createChannel!');
        console.log(error1);
        throw error1;
      }
      console.log(`(${receiverName}) : createChannel finished! connecting to ${queueName}`);

      channel.assertQueue(queueName, {
        durable: true,
      });
      console.log(` (${receiverName}) : Waiting for messages in %s. To exit press CTRL+C`, queueName);
      channel.consume(
        queueName,
        (msg) => {
          if (!msg) {
            console.log(`(${receiverName}) : BAD MESSAGE`);
            return;
          }
          console.log(` (${receiverName}) : Received %s`, msg.content.toString());
        },
        {
          noAck: true,
        }
      );
    });
  });
}
