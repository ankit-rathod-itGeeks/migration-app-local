import fs from "fs";
import os from "os";
import process from "process";

import { ImportJobModel } from "../modals/job.modal.js";
import { migrateProducts } from "../utils/productSync.js";
import { migrateCustomers } from "../utils/customerSync.js";
import { migrateOrdersFromSheet } from "../utils/orderSync.js";

const WORKER_ID = process.env.WORKER_ID || `${os.hostname()}-${process.pid}`;
const MAX_JOBS_PER_KICK = Number(process.env.MAX_JOBS_PER_KICK || 2);
const LOCK_TTL_MINUTES = Number(process.env.JOB_LOCK_TTL_MINUTES || 60);

// Prevent multiple overlapping kicks in the same process
let inFlight = false;

// If a kick arrives while inFlight=true, we remember it and run again after finishing
let pendingKick = false;

function getFileNameFromPath(p) {
  if (!p) return "";
  const s = String(p);
  return s.split(/[/\\]/).pop() || s;
}

/**
 * Claim the next available queued job (ANY resourceKey).
 * This fixes: "job #2 stays queued forever" when second job has a different resourceKey.
 *
 * Also fixes: lockedAt being undefined (not null) by including $exists:false.
 */
async function claimNextJob() {
  const staleBefore = new Date(Date.now() - LOCK_TTL_MINUTES * 60 * 1000);

  const filter = {
    status: "queued",
    $or: [
      { lockedAt: { $exists: false } },
      { lockedAt: null },
      { lockedAt: { $lt: staleBefore } },
    ],
  };

  return ImportJobModel.findOneAndUpdate(
    filter,
    {
      $set: {
        status: "running",
        lockedAt: new Date(),
        lockedBy: WORKER_ID,
        message: "Job claimed",
        error: "",
      },
    },
    {
      new: true,
      sort: { createdAt: 1 }, // if you have timestamps; otherwise Mongo still returns something
    }
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
  const resourceKey = job.resourceKey;

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
      { $set: { message: "Migrating..." } }
    );

    switch (resourceKey) {
      case "products": {
        const result = await migrateProducts(buffer);
        await markCompleted(jobId, result);
        break;
      }
      case "customers": {
        const result = await migrateCustomers(buffer);
        await markCompleted(jobId, result);
        break;
      }
      case "orders": {
        // IMPORTANT: your migrateOrdersFromSheet must accept buffer (not req,res)
        const result = await migrateOrdersFromSheet(buffer);
        await markCompleted(jobId, result);
        break;
      }
      default:
        await markFailed(
          jobId,
          "Unsupported resourceKey",
          `Unsupported resourceKey: ${resourceKey}`
        );
        return;
    }
  } catch (err) {
    await markFailed(jobId, "Failed", err?.message || String(err));
  }
}

export async function kickProductsJobWorker() {
  // If a kick arrives during an active run, remember it and exit.
  if (inFlight) {
    pendingKick = true;
    return;
  }

  inFlight = true;

  try {
    while (true) {
      const jobs = [];

      for (let i = 0; i < MAX_JOBS_PER_KICK; i++) {
        const job = await claimNextJob();
        if (!job) break;
        jobs.push(job);
      }

      if (!jobs.length) break;

      await Promise.allSettled(jobs.map((job) => runJob(job)));
      // loop continues until no more queued jobs
    }
  } finally {
    inFlight = false;

    // If another kick happened while we were running, immediately run again
    if (pendingKick) {
      pendingKick = false;
      setTimeout(() => {
        kickProductsJobWorker().catch((e) =>
          console.error("Worker kick error:", e)
        );
      }, 0);
    }
  }
}

export function kickResourceJobWorkerAsync() {
  setTimeout(() => {
    kickProductsJobWorker().catch((e) =>
      console.error("Worker kick error:", e)
    );
  }, 0);
}
