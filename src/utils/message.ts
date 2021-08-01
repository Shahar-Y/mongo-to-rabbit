import { ChangeEvent } from 'mongodb';
import { ExchangeSendProperties, menash, QueueSendProperties } from 'menashmq';
import { logger } from '../index';
import { errorModel, IError } from '../models/errorMsgModel';
import {
  DataObjectType,
  MiddlewareFuncType,
  MongoDataType,
  MTROptions,
  QueueObjectType,
  ChangeOperation,
} from '../paramTypes';
import { criticalLog } from './logger';

const defaultMiddleware: MiddlewareFuncType = (data: DataObjectType) => data;

const sendMsgTimeout = 30000;

/**
 * formatAndSendMsg - parse msg and send it to queue
 * @param {QueueObjectType}             queue     - queue object
 * @param {MTROptions}                  options   - options for package
 * @param {ChangeEvent<Object>} event     - mongo change event
 * @param {MongoDataType}               mongoData - mongoData options
 */
export async function formatAndSendMsg(
  queue: QueueObjectType,
  options: MTROptions,
  event: ChangeEvent<any>,
  mongoData: MongoDataType
): Promise<void> {
  let formattedData;

  if (options.prettify) {
    formattedData =
      queue.middleware === undefined
        ? defaultMiddleware(prettifyData(event), mongoData.collectionName)
        : queue.middleware(prettifyData(event), mongoData.collectionName);
  } else {
    formattedData = event;
  }

  if (formattedData) {
    Array.isArray(formattedData)
      ? await Promise.all(formattedData.map(async (dataContent) => sendMsg(queue, dataContent, true)))
      : await sendMsg(queue, formattedData, true);
  }
}

/**
 * sendMsg function to queue - by exchange or direct queue
 * @param {QueueObjectType} queue   - queue object
 * @param {any}             msg     - formatted msg
 * @param {boolean}         isMongoWatcher - is msg from mongo watcher or initiated manually
 * @param {number}          msgTimeout - timeout in milliseconds for send msg
 */
export async function sendMsg(
  queue: QueueObjectType,
  msg: any,
  isMongoWatcher = false,
  msgTimeout: number = sendMsgTimeout
): Promise<void> {
  // mark our messages as persistent, tells rabbitmq to save the message for durability
  const sendProperties: ExchangeSendProperties | QueueSendProperties = { deliveryMode: 2 };

  const sender = async () => {
    queue.exchange
      ? await menash.send(queue.exchange.name, msg, sendProperties, queue.exchange.routingKey)
      : await menash.send(queue.name, msg, sendProperties);
  };

  // Check if send msg to rabbit was succesful, defines a timeout for the sender
  await Promise.race([
    sender(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), msgTimeout)),
  ]).catch((err) => {
    const errMsg = `error in sending rabbit msg, ${err}`;
    if (isMongoWatcher) throw new Error(errMsg);

    // Create error rabbit sender
    criticalLog(errMsg);
    const errorDoc: IError = { formattedMsg: msg, destQueue: queue, error: err };
    errorModel.create(errorDoc, async (error: any) => {
      err ? console.error('err in create error msg doc', errorDoc, error) : criticalLog('send to rabbit error');
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
    operation: ChangeOperation.UNKNOWN,
    fullDocument: {},
    updateDescription: { updatedFields: {}, removedFields: [] },
  };

  if (!data) return dataObject;

  dataObject.operation = data.operationType || ChangeOperation.UNKNOWN;
  if ((<any>data).documentKey) dataObject.id = (<any>data).documentKey._id;

  switch (dataObject.operation) {
    case ChangeOperation.INSERT:
      dataObject.fullDocument = (<any>data).fullDocument;
      break;
    case ChangeOperation.REPLACE:
      dataObject.fullDocument = (<any>data).fullDocument;
      break;
    case ChangeOperation.UPDATE:
      dataObject.fullDocument = (<any>data).fullDocument;
      dataObject.updateDescription = (<any>data).updateDescription;
      break;
    case ChangeOperation.DELETE:
      break;
    default:
      logger.log(`An unknown operation occurred: ${dataObject.operation}`);
  }

  return dataObject;
}

/** sendFailedMsg - send failed msg * */
export async function sendFailedMsg(): Promise<void> {
  try {
    const failedMsgs: IError[] = await errorModel.find({}).sort({ createdAt: -1 });
    await errorModel.deleteMany({});
    await Promise.all(failedMsgs.map(async (failedmsg) => await sendMsg(failedmsg.destQueue, failedmsg.formattedMsg)));
  } catch (error) {
    criticalLog(error);
  }
}
