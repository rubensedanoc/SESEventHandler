'use strict';

/**
 * Supported SES event types sent through SNS notifications.
 */
const SES_EVENT_TYPES = [
  'Bounce',
  'Complaint',
  'Delivery',
  'Send',
  'Reject',
  'Open',
  'Click',
  'RenderingFailure',
  'DeliveryDelay',
];

/**
 * Processes a parsed SES event object and returns a normalized result.
 * @param {object} sesEvent - Parsed SES event from the SNS Message body.
 * @returns {{ eventType: string, data: object }}
 */
function handleSesEvent(sesEvent) {
  const eventType = sesEvent.eventType || sesEvent.notificationType;

  if (!eventType) {
    throw new Error('SES event is missing eventType/notificationType field');
  }

  if (!SES_EVENT_TYPES.includes(eventType)) {
    throw new Error(`Unknown SES event type: ${eventType}`);
  }

  return { eventType, data: sesEvent };
}

module.exports = { handleSesEvent, SES_EVENT_TYPES };
