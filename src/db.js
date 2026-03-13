import mongoose from "mongoose";

export async function connectToDatabase(mongoUri) {
  mongoose.set("strictQuery", true);

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 10000
  });
}
