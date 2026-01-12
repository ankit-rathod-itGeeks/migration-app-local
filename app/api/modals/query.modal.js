import mongoose from "mongoose";

const QuerySchema = new mongoose.Schema(
  {
    resourceKey: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    query: { type: String, required: true },
  },
  { timestamps: true }
);

export const QueryModel =
  mongoose.models.Query || mongoose.model("Query", QuerySchema);
