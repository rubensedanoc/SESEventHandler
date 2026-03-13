import mongoose from "mongoose";

const recipientSchema = new mongoose.Schema(
  {
    emailAddress: { type: String, trim: true },
    status: { type: String, trim: true },
    action: { type: String, trim: true },
    diagnosticCode: { type: String, trim: true }
  },
  { _id: false }
);

const mailSchema = new mongoose.Schema(
  {
    timestamp: Date,
    source: String,
    sourceArn: String,
    sendingAccountId: String,
    messageId: String,
    destination: [String],
    tags: { type: Map, of: [String], default: undefined },
    commonHeaders: { type: mongoose.Schema.Types.Mixed },
    headers: { type: [mongoose.Schema.Types.Mixed], default: undefined }
  },
  { _id: false }
);

const sesEventSchema = new mongoose.Schema(
  {
    notificationType: {
      type: String,
      enum: ["Delivery", "Bounce", "Complaint", "Reject", "SubscriptionConfirmation", "Unknown"],
      required: true
    },
    snsMessageId: { type: String, index: true },
    snsTopicArn: { type: String, index: true },
    sesMessageId: { type: String, index: true },
    mail: mailSchema,
    eventTimestamp: Date,
    delivery: {
      processingTimeMillis: Number,
      timestamp: Date,
      smtpResponse: String,
      reportingMTA: String,
      recipients: [String]
    },
    bounce: {
      bounceType: String,
      bounceSubType: String,
      feedbackId: String,
      reportingMTA: String,
      timestamp: Date,
      remoteMtaIp: String,
      bouncedRecipients: [recipientSchema]
    },
    complaint: {
      feedbackId: String,
      complaintSubType: String,
      complaintFeedbackType: String,
      userAgent: String,
      timestamp: Date,
      complainedRecipients: [recipientSchema]
    },
    reject: {
      reason: String
    },
    rawSnsMessage: { type: mongoose.Schema.Types.Mixed, required: true },
    rawSesMessage: mongoose.Schema.Types.Mixed
  },
  {
    timestamps: true
  }
);

sesEventSchema.index({ notificationType: 1, eventTimestamp: -1 });

export const SesEvent = mongoose.model("SesEvent", sesEventSchema);
