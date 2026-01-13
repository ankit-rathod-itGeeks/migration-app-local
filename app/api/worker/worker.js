import fs from "fs";
import os from "os";
import process from "process";

import { ImportJobModel } from "../modals/job.modal.js"; // adjust path
import { migrateProducts } from "../utils/productSync.js"; // your existing migration

const WORKER_ID = process.env.WORKER_ID || `${os.hostname()}-${process.pid}`;
const MAX_JOBS_PER_KICK = Number(process.env.MAX_JOBS_PER_KICK || 2);
const LOCK_TTL_MINUTES = Number(process.env.JOB_LOCK_TTL_MINUTES || 60);

// Prevent multiple overlapping kicks in the same process
let inFlight = false;

function getFileNameFromPath(p) {
  if (!p) return "";
  const s = String(p);
  return s.split(/[/\\]/).pop() || s;
}

// Atomically claim 1 queued job (or reclaim stale locked)
// async function claimOneProductsJob(resourceKey, file, job) {
//   console.log("claimOneProductsJob", resourceKey, "job-----------", job);
//   const staleBefore = new Date(Date.now() - LOCK_TTL_MINUTES * 60 * 1000);

//   return ImportJobModel.findOneAndUpdate(
//     {
//       resourceKey: resourceKey,
//       status: "queued",
//       $or: [{ lockedAt: null }, { lockedAt: { $lt: staleBefore } }],
//     },
//     {
//       $set: {
//         status: "running",
//         lockedAt: new Date(),
//         lockedBy: WORKER_ID,
//         message: "Job claimed",
//         error: "",
//       },
//     },
//     { new: true }
//   );
// }

async function claimOneProductsJob(resourceKey, file, job) {
  console.log("claimOneProductsJob", resourceKey, "job-----------", job);

  if (!job?._id) throw new Error("Missing job._id");

  const staleBefore = new Date(Date.now() - LOCK_TTL_MINUTES * 60 * 1000);

  return ImportJobModel.findOneAndUpdate(
    {
      _id: job._id, 
      resourceKey: resourceKey,
      status: "queued",
      // $or: [{ lockedAt: null }, { lockedAt: { $lt: staleBefore } }],
    },
    {
      $set: {
        status: "running",
        lockedAt: new Date(),
        lockedBy: WORKER_ID,
        message: "Job claimed",
        error: "",
      },
    },
    { new: true }
  );
}

async function markFailed(jobId, message, error) {
  await ImportJobModel.updateOne(
    { _id: jobId },
    {
      $set: {
        status: "failed",
        message: message || "Failed",
        error: error || "Unknown error",
        lockedAt: null,
        lockedBy: null,
      },
    }
  );
}

async function markCompleted(jobId, result) {
  const reportPath = result?.reportPath || "";
  const reportFileName = getFileNameFromPath(reportPath);

  const total = Number(result?.reportCount ?? result?.totalProcessed ?? 0);
  const success = Number(result?.successCount ?? 0);
  const failed = Number(result?.failedCount ?? 0);

  await ImportJobModel.updateOne(
    { _id: jobId },
    {
      $set: {
        status: "completed",
        message: "Completed",
        error: "",
        reportPath,
        reportFileName,
        progress: {
          total,
          processed: total,
          success,
          failed,
        },
        lockedAt: null,
        lockedBy: null,
      },
    }
  );
}

async function runJob(job) {
  const jobId = job._id;

  try {
    if (!job.uploadedFilePath || !fs.existsSync(job.uploadedFilePath)) {
      await markFailed(
        jobId,
        "Uploaded file not found",
        `Missing file: ${job.uploadedFilePath}`
      );
      return;
    }

    await ImportJobModel.updateOne(
      { _id: jobId },
      { $set: { message: "Reading file..." } }
    );

    const buffer = fs.readFileSync(job.uploadedFilePath);

    await ImportJobModel.updateOne(
      { _id: jobId },
      { $set: { message: "Migrating products..." } }
    );

    // ✅ your existing migration (no change)
    const result = await migrateProducts(buffer);

    await markCompleted(jobId, result);
  } catch (err) {
    await markFailed(jobId, "Failed", err?.message || String(err));
  }
}

export async function kickProductsJobWorker(resourceKey, file, createdJob) {
  // If a kick is already running in this process, don't start another
  if (inFlight) return;

  inFlight = true;

  try {
    // 1) Claim up to N jobs first (serial claim, atomic in DB)
    const jobs = [];
    for (let i = 0; i < MAX_JOBS_PER_KICK; i++) {
      const job = await claimOneProductsJob(resourceKey, file, createdJob);
      if (!job) break;
      jobs.push(job);
    }

    if (!jobs.length) return;

    // 2) Run jobs concurrently
    await Promise.allSettled(jobs.map((job) => runJob(job)));
  } finally {
    inFlight = false;
  }
}

/**
 * Fire-and-forget wrapper:
 * - call this from upload route AFTER job is created
 * - never await this in the request handler
 */
export function kickProductsJobWorkerAsync(resourceKey, file, job) {
  // schedule after response work begins
  setTimeout(() => {
    kickProductsJobWorker(resourceKey, file, job).catch((e) =>
      console.error("Worker kick error:", e)
    );
  }, 0);
}
