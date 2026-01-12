// app/models/ImportJob.server.js
import mongoose from "mongoose";

const ProgressSchema = new mongoose.Schema(
  {
    total: { type: Number, default: 0 },
    processed: { type: Number, default: 0 },
    success: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  { _id: false }
);

const ImportJobSchema = new mongoose.Schema(
  {
    // what are we importing
    resourceKey: {
      type: String,
      required: true,
      enum: ["products", "orders", "customers", "products_job"],
      index: true,
    },

    // file info
    originalFileName: { type: String, required: true },
    uploadedFilePath: { type: String, required: true }, // e.g. /uploads/<jobId>_<name>.xlsx

    // job status
    status: {
      type: String,
      required: true,
      enum: ["queued", "running", "completed", "failed"],
      default: "queued",
      index: true,
    },

    progress: { type: ProgressSchema, default: () => ({}) },

    message: { type: String, default: "" }, // latest status message for UI
    error: { type: String, default: "" },   // error string if failed

    // report info (download later)
    reportFileName: { type: String, default: "" }, // e.g. products_upload_report_YYYY...xlsx
    reportPath: { type: String, default: "" },     // absolute/relative path on server

    // locking (so only one worker processes a job)
    lockedAt: { type: Date, default: null, index: true },
    lockedBy: { type: String, default: null },

    // optional: helpful for idempotency / duplicate prevention later
    fileHash: { type: String, default: "", index: true }, // sha256/md5
  },
  { timestamps: true }
);

export const ImportJobModel = mongoose.models.ImportJob || mongoose.model("ImportJob", ImportJobSchema)
