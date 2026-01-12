import { route } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default [
    ...(await flatRoutes()),
     route("/api/connect/*", "./api/controller/connection.$.js"),
     route("/api/resources/*", "./api/controller/joomla.$.js"),
     route("/api/upload", "./api/controller/upload.js")
    ];