import { sendResponse } from "../utils/sendResponse.js";
import { uploadResourceJob } from "../services/upload.server.js";
import { ImportJobModel } from "../modals/job.modal.js";
import path from "path";
import fs from "fs";

export const loader = async ({ request, params }) => {
  try {
    const url = new URL(request.url);
    const pathname = params["*"];

    const resourceKey = url.searchParams.get("resourceKey");
    const jobId = url.searchParams.get("jobId");

    switch (pathname) {
      case "status": {
        if (!jobId) {
          return sendResponse(400, false, "jobId is required");
        }

        const job = await ImportJobModel.findById(jobId).lean();

        if (!job) {
          return sendResponse(404, false, "Job not found");
        }

        return sendResponse(200, true, "Job status", job);
      }

      case "list": {
        if (!resourceKey) {
          return sendResponse(400, false, "resourceKey is required");
        }

        const jobs = await ImportJobModel.find({ resourceKey })
          .sort({ createdAt: -1 })
          .lean();

        return sendResponse(200, true, "Jobs list", { jobs });
      }

      case "download": {
        if (!jobId) {
          return sendResponse(400, false, "jobId is required");
        }

        const job = await ImportJobModel.findById(jobId).lean();
        if (!job || !job.reportPath) {
          return sendResponse(404, false, "Report not found");
        }

        const filePath = path.resolve(job.reportPath);

        if (!fs.existsSync(filePath)) {
          return sendResponse(404, false, "File does not exist");
        }

        const fileName =
          job.reportFileName || path.basename(filePath);

        return new Response(fs.createReadStream(filePath), {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${fileName}"`,
          },
        });
      }

      default:
        return sendResponse(
          400,
          false,
          "Invalid path. Use /status or /list"
        );
    }
  } catch (error) {
    console.error("Upload loader error:", error);
    return sendResponse(500, false, "Internal server error");
  }
};
export const action = async ({ request }) => {
  try {

    const formData = await request.formData();
    const resourceKey = formData.get("resourceKey");
    const file = formData.get("file");
    const settings = JSON.parse(formData.get("settings"));

    const data = await uploadResourceJob(resourceKey, file, settings);
    return sendResponse(200, true, "uploadResourceJob", data);

  } catch (error) {
    console.error("Upload error:", error);
    return sendResponse(500, false, "Internal server error");
  }
};
