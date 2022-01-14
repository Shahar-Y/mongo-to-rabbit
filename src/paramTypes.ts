import { ExchangeType } from 'menashmq';

export type RabbitDataType = {
  queues: QueueObjectType[];
  rabbitURI: string;
  rabbitRetries?: number;
  healthCheckInterval?: number;
};

export type MongoDataType = {
  collectionName: string;
  connectionString: string;
  healthCheckInterval?: number;
};

/**
 * silent: if true - no logs.
 * prettify: if true - will filter the result and send it in a specific format.
 * allowTracker: if true - will allow the package to track the last point of update for a given collection.
 *  Notice that this will create a new collection for each collectionName with the name: mtr-<collectionName>-tracker.
 */
export type MTROptions = {
  silent: boolean;
  prettify: boolean;
  allowTracker: boolean;
};

export enum ChangeOperation {
  INSERT = 'insert',
  UPDATE = 'update',
  DELETE = 'delete',
  REPLACE = 'replace',
  UNKNOWN = 'unknown',
}

export type DataObjectType = {
  id: string;
  operation: string;
  fullDocument: object;
  updateDescription: {
    updatedFields: object;
    removedFields: string[];
  };
};

export type ExchangeObjectType = {
  name: string;
  type: ExchangeType;
  routingKey?: string;
};

export type QueueObjectType = {
  name: string;
  exchange?: ExchangeObjectType;
  middleware?: MiddlewareFuncType;
};

type SupportedReturnTypes = null | string | Object | Buffer | string[] | Object[] | Buffer[] | undefined;

export type MiddlewareFuncType = (dataObject: DataObjectType, collection?: string) => SupportedReturnTypes;
