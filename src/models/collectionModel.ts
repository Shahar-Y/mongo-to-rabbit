import mongoose, { Schema } from 'mongoose';

// collectionSchema
const collectionSchema = new Schema({}, { strict: false });

const collectionModel = (collectionName: string): mongoose.Model<any> => {
  return mongoose.model(`${collectionName}`, collectionSchema);
};

export default collectionModel;
