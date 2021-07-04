import mongoose, { Schema } from "mongoose";

const changeStreamSchema = new Schema({
  eventId: { type: String, unique: true },
  timeStamp: Number,
  description: Object,
  createdAt: { type: Date, default: Date.now, index: { expireAfterSeconds: 3600 } },
});

export const changeStreamTrackerModel = (collectionName: string) => {
  return mongoose.model(`${collectionName}-events`, changeStreamSchema);
};
