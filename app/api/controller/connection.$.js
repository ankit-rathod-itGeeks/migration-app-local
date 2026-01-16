import { connectToJoomla, getConnectionList, getResourceQuery } from "../services/connection.server";
import { sendResponse } from "../utils/sendResponse";

export const loader = async ({ request, params }) => {
  const url = new URL(request.url);

  const path = params["*"];
  switch (path) {

    case "list": {
      try {
        const data = await getConnectionList();
        return sendResponse(200, true, "connection list loaded", data);
      } catch (error) {
        console.error(error);
        return sendResponse(500, false, error?.message || "Failed to get list of connections");
      }
    }
    case "query": {
      try {
        const resourceKey = url.searchParams.get("resourceKey");
        const extensionKey = url.searchParams.get("extensionKey");
        const data = await getResourceQuery(resourceKey,extensionKey);
        return sendResponse(200, true, "query  loaded", data);
      } catch (error) {
        console.error(error);
        return sendResponse(500, false, error?.message || "Failed to get list of connections");
      }
    }
  }

};

export const action = async ({ request, params }) => {
  const method = request.method;
  const url = new URL(request.url);
  const path = params["*"];

  const body = await request.json();
  console.log(body);


  if (method === "POST") {
    switch (path) {
      case "joomla": {
        try {
          const data = await connectToJoomla(body);
          return sendResponse(200, true, "Connected to Joomla", data);
        } catch (error) {
          console.error(error);
          return sendResponse(500, false, error?.message || "Failed to connect to Joomla");
        }
      }
    }

  }

};
