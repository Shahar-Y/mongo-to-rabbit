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

export type MTROptions = {
  silent: boolean;
  prettify: boolean;
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
