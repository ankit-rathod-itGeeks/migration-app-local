import mysql from "mysql2/promise";
import { QueryModel } from "../modals/query.modal.js";
import { JoomlaConnectionModel } from "../modals/joomlaConnection.js";

let pool;

function getJoomlaPool(body) {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.JOOMLA_DB_HOST,
      user: process.env.JOOMLA_DB_USER,
      //   password: process.env.JOOMLA_DB_PASSWORD, // ← enable this
      database: process.env.JOOMLA_DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });
  }
  return pool;
}

export const connectToJoomla = async (body) => {
  try {
    const db = getJoomlaPool(body);
    const [rows] = await db.query("SELECT 1 AS ok");
    console.log(rows);
    if (rows?.[0]?.ok !== 1) {

      await JoomlaConnectionModel.create({
        userName: body.userName,
        hostName: body.hostName,
        dbName: body.dbName,
        password: body.password,
        shopifyDomain: body.shopifyDomain,
        shopifyAccessToken: body.shopifyAccessToken,
        status: "failed"
      });

      return {
        status: false,
        message: "Database responded unexpectedly",
      };
    }

    await JoomlaConnectionModel.create({
      userName: body.userName,
      hostName: body.hostName,
      dbName: body.dbName,
      password: body.password,
      shopifyDomain: body.targetShopDomain,
      shopifyAccessToken: body.targetShopAccessToken,
      status: "connected"

    });

    return {
      status: true,
      message: "Successfully connected to Joomla database",
    };
  } catch (err) {
    return {
      status: false,
      message: err.message || "Failed to connect to Joomla database",
    };
  }
};
export const getConnectionList = async () => {
  try {
    const list = await JoomlaConnectionModel.find({}).sort({ createdAt: -1 });
    return {
      status: true,
      message: "Successfully connected to Joomla database",
      data: list
    };
  } catch (err) {
    return {
      status: false,
      message: err.message || "Failed to connect to Joomla database",
    };
  }
};
export const getResourceQuery = async (resourceKey) => {
  try {
    const list = await QueryModel.findOne({resourceKey})
    return {
      status: true,
      message: "Query get successfully",
      data: list
    };
  } catch (err) {
    return {
      status: false,
      message: err.message || "Failed to get query",
    };
  }
};
