# mongo-to-rabbit

An npm package designed for listening to a Mongodb and notifying a RabbitMQ server

## To run the package locally with the example: 
1. run rabbit locally: `docker run -it --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management`
2. Initiate the mongo replica: `sudo mongod --replSet rs0`
3. `npm run connect`
4. `mongo`
5. `>use devDB`
6. `db.files.insertOne({ "name": "it works!"})`

* If succeeded, you should see the result sent at the console.log of the receiver.

## In order to use the package, you must send two object parameters:

### Rabbit Data:
contains 2 fields: 
1. `queueName : string` : the name of the queue to send the information to and receive information from
2. `rabbitURI : string` : the connection string of the rabbitMQ server.

### Mongo Data:
contains 6 fields:
1. `collectionName  : string`           : the name of the mongo collection yoa want to listen to
2. `mongoURI        : string`           : the connection string of the mongo server.
3. `mongoModel      : mongoose.Model`   : the mongoose model in the db.
4. `dbName          : string`           : the name of the mongo db in which your collection resides.
5. `replicaSet      : string`           : the name of your mongo replicaset.
6. `prettify        : boolean`          : if true, will filter the result and send it in a specific formt.

#### Example: 

var rabbitData: RabbitDataType = {
    queueName: 'myQueueName2',
    rabbitURI: 'amqp://localhost'
};


let mongoData = {
    collectionName,
    mongoURI: 'mongodb://localhost:27017',
    mongoModel: fileModel,                  // created earlier
    dbName: 'devDB',
    replicaSet: 'rs0',
    prettify: false
};

* For a more specific example, look at the `src/example` folder.
