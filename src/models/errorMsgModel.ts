import mongoose, { Schema } from 'mongoose';
import { QueueObjectType } from '../paramTypes';

export interface IError {
  formattedMsg: Object;
  destQueue: QueueObjectType;
  error: Object;
  createdAt?: Date;
}

// changeStreamSchema is the schema that document when is the last
// change event for reliability
const errorSchemaModel = new Schema({
  formattedMsg: {
    type: Object,
    required: true,
  },
  destQueue: {
    type: Object,
    required: true,
  },
  error: {
    type: Object,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const errorModel = mongoose.model<IError & mongoose.Document>('error-rabbit', errorSchemaModel);
