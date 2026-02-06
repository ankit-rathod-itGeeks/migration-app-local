import fs from "fs";
import path from "path";
import { ImportJobModel } from "../modals/job.modal.js"
import { kickResourceJobWorkerAsync } from "../worker/worker.js"
function ensureUploadsDir() {
    const dir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function safeOriginalName(name) {
    // keep it simple & safe for filesystem
    const base = path.basename(String(name || "file.xlsx"));
    return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}
const ALLOWED_UPLOAD_TYPES = [".xlsx", ".xls", ".csv"];
export const uploadResourceJob = async (resourceKey, file, settings = {}) => {
    console.log("settings==", settings);


    if (!(file instanceof File)) {
        return { status: false, message: "File is required" };
    }

    const originalName = safeOriginalName(file.name);
    const lower = originalName.toLowerCase();

    if (!ALLOWED_UPLOAD_TYPES.some((ext) => lower.endsWith(ext))) {
        return { status: false, message: "Only .xlsx/.xls/.csv allowed" };
    }

    const uploadsDir = ensureUploadsDir();

    // ✅ create a unique filename BEFORE creating the DB record
    // because uploadedFilePath is required in schema
    const uniquePart = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const fileNameOnDisk = `${uniquePart}_${originalName}`;
    const filePath = path.join(uploadsDir, fileNameOnDisk);

    // ✅ save file first
    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

    // ✅ now create job with valid uploadedFilePath
    const job = await ImportJobModel.create({
        resourceKey: resourceKey,
        originalFileName: originalName,
        uploadedFilePath: filePath,
        status: "queued",
        progress: { total: 0, processed: 0, success: 0, failed: 0 },
        message: "File uploaded",
        lockedAt: null,
        lockedBy: null,
        settings: settings
    });

    kickResourceJobWorkerAsync(resourceKey, file, job, settings);

    return {
        status: true,
        message: "Job created",
        data: {
            jobId: String(job._id),
            requestResourceKey: resourceKey,
            storedResourceKey: resourceKey,
            originalFileName: originalName,
        },
    };
};


