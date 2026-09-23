import mongoose from "mongoose";

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is required. Use your MongoDB Atlas connection string.",
    );
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    maxPoolSize: 20,
    maxIdleTimeMS: 300000,
  });
  console.log(
    `MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`,
  );
}
