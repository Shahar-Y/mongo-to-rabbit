import mongoose, { Schema } from 'mongoose';

interface ChangeStream {
  description: Object;
  eventId: String;
  createdAt: Date;
}

// changeStreamSchema is the schema that document when is the last
// change event for reliability
const changeStreamSchema = new Schema({
  description: Object,
  eventId: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
});

const changeStreamTrackerModel = (collectionName: string): mongoose.Model<any> => {
  return mongoose.model<ChangeStream & mongoose.Document>(`${collectionName}-events`, changeStreamSchema);
};

export default changeStreamTrackerModel;
