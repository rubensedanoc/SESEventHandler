import express from "express";
import { createSnsController } from "./controllers/sns-controller.js";

export function createApp(config) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({
      success: true
    });
  });

  app.post("/webhooks/sns", createSnsController(config));

  app.use((err, _req, res, _next) => {
    const statusCode = err.statusCode ?? 500;
    const message = err.message ?? "Internal server error";

    if (statusCode >= 500) {
      console.error(err);
    }

    res.status(statusCode).json({
      success: false,
      error: message
    });
  });

  return app;
}
