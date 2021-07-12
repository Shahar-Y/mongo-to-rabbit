import mongoose, { Schema } from 'mongoose';

// collectionSchema
const collectionSchema = new Schema({}, { strict: false });

export const collectionModel = (collectionName: string) => {
  return mongoose.model(`${collectionName}`, collectionSchema);
};
