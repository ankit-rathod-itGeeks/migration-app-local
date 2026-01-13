import fs from "fs";
import os from "os";
import process from "process";

import { ImportJobModel } from "../modals/job.modal.js";
import { migrateProducts } from "../utils/productSync.js";
import { migrateCustomers } from "../utils/customerSync.js";
import { migrateOrdersFromSheet } from "../utils/orderSync.js";

const WORKER_ID = process.env.WORKER_ID || `${os.hostname()}-${process.pid}`;

/**
 * How many jobs a SINGLE worker process should run in parallel.
 * When you scale "across multiple worker processes", keep this small (1–2).
 */
const MAX_JOBS_PER_PROCESS = Number(process.env.MAX_JOBS_PER_PROCESS || 3);

/**
 * Lock TTL (minutes). If a worker dies mid-job, another worker can pick it up after TTL.
 */
const LOCK_TTL_MINUTES = Number(process.env.JOB_LOCK_TTL_MINUTES || 60);

/**
 * Poll interval for workers (ms). Each worker process wakes up and tries to claim jobs.
 */
const POLL_INTERVAL_MS = Number(process.env.JOB_POLL_INTERVAL_MS || 1500);

/**
 * If you want one worker process to handle ONLY a specific resourceKey:
 *   WORKER_RESOURCE_KEY=orders
 * or leave empty to process all.
 */
const WORKER_RESOURCE_KEY = process.env.WORKER_RESOURCE_KEY || "";

/**
 * Internal flags to avoid overlapping loops in same process
 */
let inFlight = false;

function getFileNameFromPath(p) {
  if (!p) return "";
  const s = String(p);
  return s.split(/[/\\]/).pop() || s;
}

/**
 * Claim the next available queued job atomically.
 * - Picks queued jobs that are not locked OR whose lock is stale.
 * - Optional filter by resourceKey (if WORKER_RESOURCE_KEY is set).
 * - Sorts by createdAt so older jobs run first.
 *
 * NOTE: Your schema should have timestamps: true so createdAt exists.
 */
async function claimNextJob() {
  const staleBefore = new Date(Date.now() - LOCK_TTL_MINUTES * 60 * 1000);

  const filter = {
    status: "queued",
    ...(WORKER_RESOURCE_KEY ? { resourceKey: WORKER_RESOURCE_KEY } : {}),
    $or: [{ lockedAt: null }, { lockedAt: { $lt: staleBefore } }],
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
      sort: { createdAt: 1 },
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

    // Optional cleanup
    // try { fs.unlinkSync(job.uploadedFilePath); } catch (_) {}
  } catch (err) {
    await markFailed(jobId, "Failed", err?.message || String(err));
  }
}

/**
 * Worker pool within ONE process:
 * - Runs MAX_JOBS_PER_PROCESS jobs concurrently.
 * - Each "slot" keeps claiming the next job until there are none.
 */
async function runWorkerPoolOnce() {
  const slots = Array.from({ length: MAX_JOBS_PER_PROCESS }, async () => {
    while (true) {
      const job = await claimNextJob();
      if (!job) break;
      await runJob(job);
    }
  });

  await Promise.allSettled(slots);
}

/**
 * MAIN LOOP (for multi-process scaling)
 * Call startImportJobWorker() once per node process.
 * Run multiple processes (2–5) and they will safely share the queue.
 */
export async function startImportJobWorker() {
  if (inFlight) return;
  inFlight = true;

  console.log(
    `🧵 Import worker started: WORKER_ID=${WORKER_ID} ` +
      `MAX_JOBS_PER_PROCESS=${MAX_JOBS_PER_PROCESS} ` +
      `WORKER_RESOURCE_KEY=${WORKER_RESOURCE_KEY || "ALL"} ` +
      `POLL_INTERVAL_MS=${POLL_INTERVAL_MS}`
  );

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await runWorkerPoolOnce();

      // Sleep a bit before polling again
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  } catch (e) {
    console.error("❌ Worker crashed:", e);
    throw e;
  } finally {
    inFlight = false;
  }
}

/**
 * If you still want "kick" behavior from your upload endpoint:
 * - It just starts the worker loop once in this process (if not already running).
 * - In multi-process setup, you usually run workers separately and don't need kicks.
 */
export function kickResourceJobWorkerAsync() {
  setTimeout(() => {
    startImportJobWorker().catch((e) =>
      console.error("Worker start error:", e)
    );
  }, 0);
}
