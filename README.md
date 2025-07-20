# mongo-to-rabbit v4.0.1

![npm](https://img.shields.io/npm/v/mongo-to-rabbit?color=green)
![NPM](https://img.shields.io/npm/l/mongo-to-rabbit)
![Snyk Vulnerabilities for npm package](https://img.shields.io/snyk/vulnerabilities/npm/mongo-to-rabbit)
![npm](https://img.shields.io/npm/dt/mongo-to-rabbit)

An npm package designed for listening to MongoDB and notifying a RabbitMQ server on changes.

[Full article](https://github.com/Shahar-Y/mongo-to-rabbit/wiki) in our Wiki.

![MTR logo](src/images/MTR-logo.jpeg)

Using [MenashMQ](https://www.npmjs.com/package/menashmq) for connection to RabbitMQ.

## Installation

1. `npm i --save mongo-to-rabbit`

## In order to use the package, you must send two object parameters:

### 1- Rabbit Data:

contains 2 fields:
| # | field | type | info | default |
|---|---|---|---|---|
| 1 | `queues` | `QueueObjectType` | array of destination queues names to send the information to and the middlewareFunc|
| 2 | `rabbitURI ` | `string` | the connection string for the rabbitMQ server |
| 3 | `healthCheckInterval?` | `number` | the health check interval for rabbit |`30000 ms`|
| 4 | `rabbitRetries?` | `number` | amount of retries to connect to rabbit |`5`|

### 2- Mongo Data:

contains 2 fields:
| # | field | type | info | default |
|---|---|---|---|---|
| 1 | `collectionName` | `string` | the name of the mongo collection you want to listen to |
| 2 | `connectionString ` | `string` | the connection string of the mongo server |
| 3 | `healthCheckInterval?` | `number` | the health check interval for mongo | `30000 ms`|

### MTROptions - optional:

contains 3 fields:
| # | field | type | info | default |
|---|---|---|---|---|
| 1 | `silent` | `boolean` | if false, logs connection and changes to the console | `true` |
| 2 | `prettify` | `boolean` | if true, will filter the result and send it in a specific format | `true`|

### Types:

| # | field | type | info | default |
|---|---|---|---|---|
| 1   | `QueueObjectType`    | `name: string, middleware?: MiddlewareFuncType exchange?: ExchangeObjectType` | queue name, middleware parser and exchange | -        |
| 2   | `MiddlewareFuncType` | `(DataObjectType, collectionName) => (null                                    | string                                     | Object   | Buffer                                                                                                               | string[] | Object[] | Buffer[] | undefined)` | A function for manipulating the prettified data received from the listener before sending it to the queue. will only work with a `prettify:true`. | [identity function](https://en.wikipedia.org/wiki/Identity_function) |
| 3   | `ExchangeObjectType` | `name: string, type: ExchangeType, routingKey?: string`                       | exchange implementation                    | -        |
| 4   | `ExchangeType`       | `fanout, topic, direct, headers` | different types of exchanges, read more at - [exchange types](https://www.rabbitmq.com/tutorials/amqp-concepts.html) | -        |

---

#### Example:

```node
import { watchAndNotify } from 'mongo-to-rabbit';

let rabbitData = {
  queues: [{ name: 'MyQueueName' }],
  rabbitURI: 'amqp://localhost',
};

let mongoData = {
  collectionName: 'files',
  connectionString: 'mongodb://localhost:27017/devDB?replicaSet=rs0',
};

watchAndNotify(mongoData, rabbitData);
```

- For a more specific example, look at the `src/example` folder.

#### The prettified type format:

```node
type DataObjectType = {
  id: string,
  operation: string,
  fullDocument: object,
  updateDescription: {
    updatedFields: object,
    removedFields: string[],
  },
};
```

- prettify will only work on operations related to documents in the collection: `insert`, `replace`, `update`, `delete`

## To run the package locally with the example:

1. run rabbit locally: `docker run -it --rm --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management`
2. Initiate the mongo replica: `sudo mongod --replSet rs0`
3. `npm run connect`
4. `npm run receive`
5. `mongo`
6. `>use devDB`
7. `db.files.insertOne({ "name": "it works!"})`

- The `connect` script connects with two different configurations to mongo and rabbit.
- The `receive` script creates two consumers to Rabbit.
- If succeeded, you should see the result sent at the console.log of the receiver.

![running example](https://media.giphy.com/media/mT5dpljEpj5uscgFH9/giphy.gif)

logo credit: <a href="https://www.vectorstock.com/royalty-free-vector/rabbit-leaf-naturally-creative-logo-vector-26785526">Vector image by VectorStock / ade01</a>
