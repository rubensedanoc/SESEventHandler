'use strict';

const express = require('express');
const { snsWebhookHandler } = require('./webhookHandler');

const app = express();

app.use(express.json({ type: ['application/json', 'text/plain'] }));

/**
 * Health-check endpoint.
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

/**
 * SNS webhook endpoint.
 * Amazon SNS sends POST requests to this URL with SES event notifications.
 */
app.post('/webhook', snsWebhookHandler);

module.exports = app;
