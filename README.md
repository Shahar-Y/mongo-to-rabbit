# mongo-to-rabbit v2.1

![npm](https://img.shields.io/npm/v/mongo-to-rabbit?color=green)
![NPM](https://img.shields.io/npm/l/mongo-to-rabbit)
![Snyk Vulnerabilities for npm package](https://img.shields.io/snyk/vulnerabilities/npm/mongo-to-rabbit)
![npm](https://img.shields.io/npm/dt/mongo-to-rabbit)

An npm package designed for listening to MongoDB and notifying a RabbitMQ server on changes.

![MTR logo](src/utils/images/MTR-logo.jpeg)

Using [MenashMQ](https://www.npmjs.com/package/menashmq) for connection to RabbitMQ.


## Installation
1. `npm i --save mongo-to-rabbit`

## In order to use the package, you must send two object parameters:

### 1- Rabbit Data:
contains 2 fields: 
| #  | field | type | info |
|---|---|---|---|
| 1 | `queueName`  | `string` | the name of the queue to send the information to |
| 2 | `rabbitURI `  | `string` | the connection string for the rabbitMQ server |

### 2- Mongo Data:

contains 3 fields:
| #  | field | type | info |
|---|---|---|---|
| 1 | `collectionName`  | `string` | the name of the mongo collection you want to listen to |
| 2 | `connectionString `  | `string` | the connection string of the mongo server |

### MTROptions - optional:

contains 3 fields:
| #  | field | type | info | default |
|---|---|---|---|---|
| 1 | `silent`  | `boolean` | if false, logs connection and changes to the console | `true` |
| 2 | `prettify `  | `boolean` | if true, will filter the result and send it in a specific format | `true`|

#### Example: 
```node
`let rabbitData = {  
    queueName: 'myQueueName',  
    rabbitURI: 'amqp://localhost'  
};`  


`let mongoData = {  
    collectionName: 'files',  
    connectionString: 'mongodb://localhost:27017/devDB?replicaSet=rs0'
};`  
```
`mongoRabbit.watchAndNotify(mongoData, rabbitData);`

* For a more specific example, look at the `src/example` folder.

#### The prettified type format:
```node
type DataObjectType = {  
    id: string;  
    operation: string;  
    fullDocument: object;  
    updateDescription: {  
        updatedFields: object;  
        removedFields: string[];  
    };  
}
```
* prettify will only work on operations related to documents in the collection: `insert`, `replace`, `update`, `delete`

## To run the package locally with the example: 
1. run rabbit locally: `docker run -it --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management`
2. Initiate the mongo replica: `sudo mongod --replSet rs0`
3. `npm run connect`
4. `npm run receive`
5. `mongo`
6. `>use devDB`
7. `db.files.insertOne({ "name": "it works!"})`

* The `connect` script connects with two different configurations to mongo and rabbit. 
* The `receive` script creates two consumers to Rabbit
* If succeeded, you should see the result sent at the console.log of the receiver.

![running example](https://media.giphy.com/media/mT5dpljEpj5uscgFH9/giphy.gif)

logo credit: <a href="https://www.vectorstock.com/royalty-free-vector/rabbit-leaf-naturally-creative-logo-vector-26785526">Vector image by VectorStock / ade01</a>