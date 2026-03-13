import {
  confirmSubscription,
  parseSnsBody,
  storeSesEvent,
  validateTopicArn
} from "../services/sns-service.js";

export function createSnsController(config) {
  return async function snsController(req, res, next) {
    try {
      const { snsMessage, sesMessage } = parseSnsBody(req.body);

      validateTopicArn(snsMessage.TopicArn, config.snsTopicArn);

      if (snsMessage.Type === "SubscriptionConfirmation") {
        await confirmSubscription(snsMessage.SubscribeURL);
        await storeSesEvent(snsMessage, null);

        return res.status(200).json({
          success: true,
          action: "subscription_confirmed"
        });
      }

      if (snsMessage.Type !== "Notification") {
        return res.status(202).json({
          success: true,
          action: "ignored",
          reason: `Unsupported SNS Type: ${snsMessage.Type}`
        });
      }

      const event = await storeSesEvent(snsMessage, sesMessage);

      return res.status(200).json({
        success: true,
        id: event.id,
        notificationType: event.notificationType
      });
    } catch (error) {
      return next(error);
    }
  };
}
