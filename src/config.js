import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  mongoUri: process.env.MONGODB_URI,
  snsTopicArn: process.env.SNS_TOPIC_ARN ?? ""
};

if (!config.mongoUri) {
  throw new Error("Missing MONGODB_URI environment variable.");
}
