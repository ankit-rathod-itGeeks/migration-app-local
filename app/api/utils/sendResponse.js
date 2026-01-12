//Response handler
export const sendResponse = (statusCode, status, message, result) => {
  return new Response(JSON.stringify({ status, message, result }), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST,PUT,DELETE, OPTIONS",
    },
  });
};
