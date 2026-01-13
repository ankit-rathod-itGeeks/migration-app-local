import XLSX from "xlsx";
import mysql from "mysql2/promise";
import ExcelJS from "exceljs";

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

