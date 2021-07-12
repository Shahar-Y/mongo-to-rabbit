import { logger } from '../index';
import { ChangeEvent } from 'mongodb';
import { errorModel, IError } from '../models/errorMsgModel';
import { ExchangeSendProperties, menash, QueueSendProperties } from 'menashmq';
import { DataObjectType, MiddlewareFuncType, MongoDataType, MTROptions, QueueObjectType } from '../paramTypes';

const defaultMiddleware: MiddlewareFuncType = (data: DataObjectType) => {
  return data;
};
const sendMsgTimeout: number = 30000;

/**
 * formatMsg - parse msg and send it to queue
 * @param {QueueObjectType}             queue     - queue object
 * @param {MTROptions}                  options   - options for package
 * @param {ChangeEvent<Object>} event     - mongo change event
 * @param {MongoDataType}               mongoData - mongoData options
 */
export async function formatMsg(
  queue: QueueObjectType,
  options: MTROptions,
  event: ChangeEvent<any>,
  mongoData: MongoDataType
) {
  const formattedData = options.prettify
    ? queue.middleware == undefined
      ? defaultMiddleware(prettifyData(event), mongoData.collectionName)
      : queue.middleware(prettifyData(event), mongoData.collectionName)
    : event;

  if (formattedData) {
    Array.isArray(formattedData)
      ? Promise.all(formattedData.map(async (dataContent) => await sendMsg(queue, dataContent, true)))
      : await sendMsg(queue, formattedData, true);
  }
}

/**
 * sendMsg function to queue - by exchange or direct queue
 * @param {QueueObjectType} queue   - queue object
 * @param {any}             msg     - formatted msg
 * @param {boolean}         isMongoWatcher - is msg from mongo watcher
 * @param {number}          msgTimeout - timeout in milliseconds for send msg
 */
export async function sendMsg(
  queue: QueueObjectType,
  msg: any,
  isMongoWatcher: boolean = false,
  msgTimeout: number = sendMsgTimeout
) {
  // mark our messages as persistent, tells rabbitmq to save the message for durability
  const sendProperties: ExchangeSendProperties | QueueSendProperties = { deliveryMode: 2 };

  const sender = async () => {
    queue.exchange
      ? await menash.send(queue.exchange.name, msg, sendProperties, queue.exchange.routingKey)
      : await menash.send(queue.name, msg, sendProperties);
  };

  // Check if send msg to rabbit was succesful
  await Promise.race([
    sender(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), msgTimeout)),
  ]).catch((err) => {
    const errMsg: string = `error in sending rabbit msg, ${err}`;
    if (isMongoWatcher) throw new Error(errMsg);

    // Create error rabbit sender
    console.log(errMsg);
    const errorDoc: IError = { formattedMsg: msg, destQueue: queue, error: err };
    errorModel.create(errorDoc, async (err: any) => {
      if (err) console.log('err in create error msg doc', errorDoc, err);
    });
  });
}

/**
 * prettifyData formats the data sent from the change event on mongo.
 * @param {ChangeEvent<any>} data    - the information sent from mongo about the change.
 * @returns an object of type DataObjectType.
 */
export function prettifyData(data: ChangeEvent<any>): DataObjectType {
  // Create the basic dataObject
  const dataObject: DataObjectType = {
    id: 'null',
    operation: 'unknown',
    fullDocument: {},
    updateDescription: { updatedFields: {}, removedFields: [] },
  };

  if (!data) {
    return dataObject;
  }

  dataObject.operation = data.operationType || 'unknown';
  if ((<any>data).documentKey) {
    dataObject.id = (<any>data).documentKey._id;
  }

  switch (dataObject.operation) {
    case 'insert':
      dataObject.fullDocument = (<any>data).fullDocument;
      break;
    case 'replace':
      dataObject.fullDocument = (<any>data).fullDocument;
      break;
    case 'update':
      dataObject.fullDocument = (<any>data).fullDocument;
      dataObject.updateDescription = (<any>data).updateDescription;
      break;
    case 'delete':
      break;
    default:
      logger.log(`An unknown operation occurred: ${dataObject.operation}`);
  }

  return dataObject;
}

/** sendFailedMsg - send failed msg **/
export async function sendFailedMsg() {
  try {
    const failedMsgs: IError[] = await errorModel.find({}).sort({ createdAt: -1 });
    await errorModel.deleteMany({});
    await Promise.all(failedMsgs.map(async (failedmsg) => await sendMsg(failedmsg.destQueue, failedmsg.formattedMsg)));
  } catch (error) {
    console.log(error);
  }
}
