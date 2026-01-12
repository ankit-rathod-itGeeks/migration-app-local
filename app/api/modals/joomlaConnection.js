// app/models/JoomlaConnection.server.js
import mongoose from "mongoose";

const JoomlaConnectionSchema = new mongoose.Schema(
    {
        userName: {
            type: String,
            required: true,
            index: true,
        },

        hostName: {
            type: String,
            required: true,
        },

        dbName: {
            type: String,
            required: true,
        },

        password: {
            type: String,
            required: true,
        },

        shopifyDomain: {
            type: String,
            required: true,
            index: true,
        },

        shopifyAccessToken: {
            type: String,
            required: true,
        },

        status: {
            type: String,
            enum: ["connected", "disconnected", "failed"],
            default: "connected",
            index: true,
        },

        message: {
            type: String,
            default: "",
        },

        error: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

export const JoomlaConnectionModel = mongoose.models.JoomlaConnection || mongoose.model("JoomlaConnection", JoomlaConnectionSchema);
