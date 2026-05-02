import { SesEvent } from "../models/ses-event.js";

function parseDate(value) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeRecipients(recipients = []) {
  return recipients.map((recipient) => ({
    emailAddress: recipient.emailAddress,
    status: recipient.status,
    action: recipient.action,
    diagnosticCode: recipient.diagnosticCode
  }));
}

export async function confirmSubscription(subscribeUrl) {
  if (!subscribeUrl) {
    throw new Error("SNS subscription message did not include SubscribeURL.");
  }

  const response = await fetch(subscribeUrl, { method: "GET" });

  if (!response.ok) {
    throw new Error(`SNS subscription confirmation failed with status ${response.status}.`);
  }

  return response.text();
}

export function parseSnsBody(body) {
  if (!body) {
    throw new Error("Request body is empty or invalid.");
  }

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      throw new Error("Request body is empty or invalid.");
    }
  }

  if (typeof body !== "object") {
    throw new Error("Request body is empty or invalid.");
  }

  if (typeof body.Message === "string") {
    try {
      return {
        snsMessage: body,
        sesMessage: JSON.parse(body.Message)
      };
    } catch {
      return {
        snsMessage: body,
        sesMessage: null
      };
    }
  }

  return {
    snsMessage: body,
    sesMessage: null
  };
}

export function validateTopicArn(topicArn, allowedTopicArn) {
  if (!allowedTopicArn) {
    return;
  }

  if (topicArn !== allowedTopicArn) {
    throw new Error("SNS TopicArn does not match the configured SNS_TOPIC_ARN.");
  }
}

export async function storeSesEvent(snsMessage, sesMessage) {
  const snsType = snsMessage.Type !== "Notification" ? snsMessage.Type : undefined;
  // sesMessage uses "notificationType" (legacy) or "eventType" (SES Event Publishing)
  const notificationType = sesMessage?.notificationType ?? sesMessage?.eventType ?? snsType ?? "Unknown";
  const mail = sesMessage?.mail;

  const event = await SesEvent.create({
    notificationType,
    snsMessageId: snsMessage.MessageId,
    snsTopicArn: snsMessage.TopicArn,
    sesMessageId: mail?.messageId,
    mail: mail
      ? {
          ...mail,
          timestamp: parseDate(mail.timestamp)
        }
      : undefined,
    eventTimestamp:
      parseDate(sesMessage?.delivery?.timestamp) ??
      parseDate(sesMessage?.bounce?.timestamp) ??
      parseDate(sesMessage?.complaint?.timestamp) ??
      parseDate(sesMessage?.deliveryDelay?.timestamp) ??
      parseDate(sesMessage?.open?.timestamp) ??
      parseDate(sesMessage?.click?.timestamp) ??
      parseDate(mail?.timestamp),
    delivery: sesMessage?.delivery
      ? {
          ...sesMessage.delivery,
          timestamp: parseDate(sesMessage.delivery.timestamp)
        }
      : undefined,
    bounce: sesMessage?.bounce
      ? {
          ...sesMessage.bounce,
          timestamp: parseDate(sesMessage.bounce.timestamp),
          bouncedRecipients: normalizeRecipients(sesMessage.bounce.bouncedRecipients)
        }
      : undefined,
    complaint: sesMessage?.complaint
      ? {
          ...sesMessage.complaint,
          timestamp: parseDate(sesMessage.complaint.timestamp),
          complainedRecipients: normalizeRecipients(sesMessage.complaint.complainedRecipients)
        }
      : undefined,
    reject: sesMessage?.reject
      ? {
          reason: sesMessage.reject.reason
        }
      : undefined,
    deliveryDelay: sesMessage?.deliveryDelay
      ? {
          ...sesMessage.deliveryDelay,
          timestamp: parseDate(sesMessage.deliveryDelay.timestamp),
          expirationTime: parseDate(sesMessage.deliveryDelay.expirationTime),
          delayedRecipients: normalizeRecipients(sesMessage.deliveryDelay.delayedRecipients)
        }
      : undefined,
    open: sesMessage?.open
      ? {
          timestamp: parseDate(sesMessage.open.timestamp),
          userAgent: sesMessage.open.userAgent,
          ipAddress: sesMessage.open.ipAddress
        }
      : undefined,
    click: sesMessage?.click
      ? {
          timestamp: parseDate(sesMessage.click.timestamp),
          userAgent: sesMessage.click.userAgent,
          ipAddress: sesMessage.click.ipAddress,
          link: sesMessage.click.link,
          linkTags: sesMessage.click.linkTags
        }
      : undefined,
    renderingFailure: sesMessage?.failure
      ? {
          errorMessage: sesMessage.failure.errorMessage,
          templateName: sesMessage.failure.templateName
        }
      : undefined,
    rawSnsMessage: snsMessage,
    rawSesMessage: sesMessage ?? undefined
  });

  return event;
}
