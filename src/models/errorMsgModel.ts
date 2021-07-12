import { QueueObjectType } from 'mongo-to-rabbit/src/paramTypes';
import mongoose, { Schema } from 'mongoose';

export interface IError {
  formattedMsg: Object;
  destQueue: QueueObjectType;
  error: Object;
  createdAt?: Date;
}

// changeStreamSchema is the schema that document when is the last
// change event for reliability
const errorSchemaModel = new Schema<IError>({
  formattedMsg: Object,
  destQueue: Object,
  error: Object,
  createdAt: { type: Date, default: Date.now },
});

export const errorModel = mongoose.model(`error-rabbit`, errorSchemaModel);
