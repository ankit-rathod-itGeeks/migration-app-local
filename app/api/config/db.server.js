// app/db/mongoose.server.js
import mongoose from "mongoose";

let cached = global.__mongooseCached;
if (!cached) cached = global.__mongooseCached = { conn: null, promise: null };

export async function connectMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing env var: MONGODB_URI");

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        // keep defaults; add options only if needed
        serverSelectionTimeoutMS: 15_000,
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;
  console.log("Connected to MongoDB");
  return cached.conn;
}

export default mongoose;
