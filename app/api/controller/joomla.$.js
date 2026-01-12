import { exportResourceExcel } from "../services/joomla.server";
import { sendResponse } from "../utils/sendResponse";

export const loader = async ({ request }) => {
    return null;
};

export const action = async ({ request }) => {
    const method = request.method;
    try {
        const body = await request.json();
        const response = await exportResourceExcel(body);

        if (!response.status) {
            return sendResponse(400, response.status, response.message);
        }

        const { buffer, fileName } = response.data;

        return new Response(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error(error);
        return new Response(error?.message || "Export failed", { status: 500 });
    }
};
