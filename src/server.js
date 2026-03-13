import { createServer } from "node:http";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { connectToDatabase } from "./db.js";

async function bootstrap() {
  await connectToDatabase(config.mongoUri);

  const app = createApp(config);
  const server = createServer(app);

  async function shutdown(signal) {
    console.log(`Received ${signal}. Shutting down gracefully...`);

    server.close(async () => {
      try {
        await mongoose.connection.close();
        console.log("MongoDB connection closed.");
        process.exit(0);
      } catch (error) {
        console.error("Error while closing MongoDB connection.", error);
        process.exit(1);
      }
    });

    setTimeout(() => {
      console.error("Forced shutdown after timeout.");
      process.exit(1);
    }, 10000).unref();
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  server.listen(config.port, () => {
    console.log(`SES SNS receiver listening on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start SES SNS receiver.");
  console.error(error);
  process.exit(1);
});
