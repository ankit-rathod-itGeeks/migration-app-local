import mongoose from "mongoose";

const QuerySchema = new mongoose.Schema(
  {
    resourceKey: {
      type: String,
      required: true,
    },
    extensionKey: {
      type: String,
      required: true,
    },
    query: { type: String, required: true },
  },
  { timestamps: true }
);

export const QueryModel =
  mongoose.models.Query || mongoose.model("Query", QuerySchema);
