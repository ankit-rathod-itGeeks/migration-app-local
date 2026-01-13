import { sendResponse } from "../utils/sendResponse.js";
import { uploadProducts, uploadProductsJob, uploadResourceJob } from "../services/joomla.server.js";
import { ImportJobModel } from "../modals/job.modal";

export const loader = async ({ request }) => {
  try {
    const url = new URL(request.url);

    // ✅ 1) Job status (single job)
    const jobId = url.searchParams.get("jobId");
    if (jobId) {
      const job = await ImportJobModel.findById(jobId).lean();

      if (!job) {
        return sendResponse(404, false, "Job not found");
      }

      return sendResponse(200, true, "Job status", job);
    }

    const resourceKey = url.searchParams.get("resourceKey") || "products";

    const jobs = await ImportJobModel.find({ resourceKey })
      .sort({ createdAt: -1 })
      .lean();

    // return list
    return sendResponse(200, true, "Jobs list", { jobs });
  } catch (error) {
    console.error("Loader error:", error);
    return sendResponse(500, false, "Internal server error");
  }
};
export const action = async ({ request }) => {
  try {
    if (request.method !== "POST") {
      return sendResponse(405, false, "Method not allowed");
    }

    const formData = await request.formData();

    const resourceKey = formData.get("resourceKey");
    const file = formData.get("file");

    const data = await uploadResourceJob(resourceKey, file);
    return sendResponse(200, true, "uploadProductsjob", data);

    // Route by resource
    // switch (resourceKey) {
    // case "products": {
    //   const data = await uploadProducts(file);
    //   return sendResponse(200, true, "uploadProducts", data);
    // }
    //   case "products": {
    //     const data = await uploadProductsJob(resourceKey, file);
    //     return sendResponse(200, true, "uploadProductsjob", data);
    //   }

    //   default:
    //     return sendResponse(400, false, "Unsupported resource");
    // }
  } catch (error) {
    console.error("Upload error:", error);
    return sendResponse(500, false, "Internal server error");
  }
};
