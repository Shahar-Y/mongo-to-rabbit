import mongoose, { Schema } from 'mongoose';

interface ChangeStream {
  description: Object;
  eventId: String;
  createdAt: Date;
}

// changeStreamSchema is the schema that document when is the last
// change event for reliability
const changeStreamSchema = new Schema<ChangeStream>({
  description: Object,
  eventId: { type: String, unique: true },
  createdAt: { type: Date, default: Date.now },
});

export const changeStreamTrackerModel = (collectionName: string) => {
  return mongoose.model(`${collectionName}-events`, changeStreamSchema);
};
