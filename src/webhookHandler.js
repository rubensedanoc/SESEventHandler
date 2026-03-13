'use strict';

const axios = require('axios');
const { handleSesEvent } = require('./sesEventHandler');

/**
 * Confirms an SNS subscription by visiting the provided SubscribeURL.
 * @param {string} subscribeUrl - The URL SNS provides for confirmation.
 */
async function confirmSubscription(subscribeUrl) {
  await axios.get(subscribeUrl);
}

/**
 * Express route handler for the SNS webhook POST endpoint.
 * Handles:
 *   - SubscriptionConfirmation: auto-confirms the SNS subscription.
 *   - Notification: parses and processes the embedded SES event.
 *   - UnsubscribeConfirmation: acknowledges gracefully.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function snsWebhookHandler(req, res) {
  const body = req.body;

  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const messageType = req.headers['x-amz-sns-message-type'] || body.Type;

  if (!messageType) {
    return res.status(400).json({ error: 'Missing SNS message type' });
  }

  if (messageType === 'SubscriptionConfirmation') {
    const subscribeUrl = body.SubscribeURL;
    if (!subscribeUrl) {
      return res.status(400).json({ error: 'Missing SubscribeURL in SubscriptionConfirmation' });
    }

    try {
      await confirmSubscription(subscribeUrl);
      console.log('[SNS] Subscription confirmed:', body.TopicArn);
      return res.status(200).json({ message: 'Subscription confirmed' });
    } catch (err) {
      console.error('[SNS] Failed to confirm subscription:', err.message);
      return res.status(500).json({ error: 'Failed to confirm subscription' });
    }
  }

  if (messageType === 'Notification') {
    const rawMessage = body.Message;

    if (!rawMessage) {
      return res.status(400).json({ error: 'Missing Message in Notification' });
    }

    let sesEvent;
    try {
      sesEvent = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
    } catch {
      return res.status(400).json({ error: 'Failed to parse SES event from SNS Message' });
    }

    try {
      const result = handleSesEvent(sesEvent);
      console.log(`[SES] Event received - type: ${result.eventType}`);
      return res.status(200).json({ message: 'Event processed', eventType: result.eventType });
    } catch (err) {
      console.error('[SES] Error processing event:', err.message);
      return res.status(422).json({ error: err.message });
    }
  }

  if (messageType === 'UnsubscribeConfirmation') {
    console.log('[SNS] UnsubscribeConfirmation received for topic:', body.TopicArn);
    return res.status(200).json({ message: 'Unsubscribe acknowledged' });
  }

  return res.status(400).json({ error: `Unsupported SNS message type: ${messageType}` });
}

module.exports = { snsWebhookHandler, confirmSubscription };
