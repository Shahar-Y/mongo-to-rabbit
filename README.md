# mongo-to-rabbit

An npm package designed for listening to a Mongodb and notifying a RabbitMQ server






## To run the package locally with the example: 
1. run rabbit locally: `docker run -it --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management`
2. Initiate the mongo replica: `sudo mongod --replSet rs0`
3. `npm run connect`
4. `mongo`
5. `>use devDB`
6. `db.files.insertOne({ "name": "it works!"})`

You should see the console.log of the receiver.