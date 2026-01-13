import XLSX from "xlsx";
import mysql from "mysql2/promise";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { migrateProducts } from "../utils/productSync.js";
import { ImportJobModel } from "../modals/job.modal.js"
import { kickProductsJobWorkerAsync } from "../worker/worker.js"
import { JoomlaConnectionModel } from "../modals/joomlaConnection.js";

let pool;

function getJoomlaPool(storeConnection) {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.JOOMLA_DB_HOST,
      user: process.env.JOOMLA_DB_USER,
      //   password: process.env.JOOMLA_DB_PASSWORD, // enable if needed
      database: process.env.JOOMLA_DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      multipleStatements: true,
    });
  }
  return pool;
}

// Allow SELECT or WITH; block writes.
function validateReadOnlySelect(sql) {
  const q = String(sql || "").trim();
  if (!q) return { ok: false, message: "Missing query" };

  const startsOk = /^select\s/i.test(q) || /^with\s/i.test(q);
  if (!startsOk) return { ok: false, message: "Only SELECT/WITH queries are allowed" };

  const blocked =
    /\b(insert|update|delete|drop|alter|truncate|grant|revoke|call|load_file|into\s+outfile|shutdown)\b/i;
  if (blocked.test(q)) return { ok: false, message: "Query contains blocked keywords" };

  return { ok: true, query: q };
}

export const exportResourceExcel = async (body) => {
  try {
    const { resourceKey, id, query } = body;

    const storeConnection = await JoomlaConnectionModel.findById(id);
    if (!storeConnection) {
      return { status: false, message: "Joomla connection not found" };
    }

    const validation = validateReadOnlySelect(query);
    if (!validation.ok) {
      return { status: false, message: validation.message };
    }

    const db = getJoomlaPool(storeConnection);

    // Optional: prevent GROUP_CONCAT truncation for tags
    await db.query("SET SESSION group_concat_max_len = 100000");

    const [rows] = await db.query(validation.query);

    // ✅ FIX: handle multi-result-set shape (rows = [resultSet1, resultSet2, ...])
    let safeRows = [];
    if (Array.isArray(rows)) {
      if (rows.length > 0 && Array.isArray(rows[0])) {
        // multipleStatements OR query contains multiple SELECTs
        safeRows =
          rows.find((rs) => Array.isArray(rs) && rs.length) || rows[0] || [];
      } else {
        // normal: rows = [{...}, {...}]
        safeRows = rows;
      }
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(resourceKey || "export");

    // ✅ FIX: if safeRows[0] is not an object, avoid 0,1,2... columns
    const firstRow = safeRows?.[0];
    const isObjectRow =
      firstRow && typeof firstRow === "object" && !Array.isArray(firstRow);

    const columns = isObjectRow ? Object.keys(firstRow) : ["message"];

    sheet.columns = columns.map((key) => ({
      header: key,
      key,
      width: Math.min(Math.max(String(key).length + 2, 12), 40),
    }));

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    if (!safeRows.length) {
      sheet.addRow({ message: "No data returned" });
    } else if (!isObjectRow) {
      // if something unexpected comes back, serialize it safely into one column
      for (const r of safeRows) {
        sheet.addRow({ message: typeof r === "string" ? r : JSON.stringify(r) });
      }
    } else {
      for (const r of safeRows) sheet.addRow(r);
    }

    const fileName = `${resourceKey}_export_${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return { status: true, data: { buffer, fileName } };
  } catch (error) {
    console.log("Error in exportResourceExcel:", error);
    return { status: false, message: error?.message || "Export failed" };
  }
};



export const uploadProducts = async (file) => {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const data = await migrateProducts(buffer);
    return {
      status: true,
      message: "Products uploaded successfully",
      data
    }

  } catch (error) {
    console.log("Error in uploadProducts:", error);
    return {
      status: false,
      message: error?.message || "Upload failed",
    };
  }
};

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
export const uploadResourceJob = async (resourceKey, file) => {
  // const allowed = new Set(["products"]);
  // if (!allowed.has(resourceKey)) {
  //     return { status: false, message: "Unsupported resourceKey" };
  // }

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
  });

  kickProductsJobWorkerAsync(resourceKey, file ,job);

  return {
    status: true,
    message: "Job created",
    data: {
      jobId: String(job._id),
      requestResourceKey: resourceKey,
      storedResourceKey: "products",
      originalFileName: originalName,
    },
  };
};


