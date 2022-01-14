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

/**
 * Returns a schema for tracking the last point of update for a given collection.
 * Creates one if none exists.
 * @param collectionName - The name of the collection to track.
 * @returns - The tracking schema.
 */
const changeStreamTrackerModel = (collectionName: string): mongoose.Model<any> => {
  return mongoose.model<ChangeStream & mongoose.Document>(`mtr-${collectionName}-tracker`, changeStreamSchema);
};

export default changeStreamTrackerModel;
