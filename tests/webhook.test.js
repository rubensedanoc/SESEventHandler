'use strict';

const request = require('supertest');
const axios = require('axios');
const app = require('../src/app');

jest.mock('axios');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSnsBody(type, extra = {}) {
  return {
    Type: type,
    MessageId: 'test-message-id',
    TopicArn: 'arn:aws:sns:us-east-1:123456789012:MyTopic',
    ...extra,
  };
}

function makeSesNotificationBody(sesEventType, extra = {}) {
  const sesEvent = { eventType: sesEventType, mail: { messageId: 'abc123' }, ...extra };
  return makeSnsBody('Notification', { Message: JSON.stringify(sesEvent) });
}

// ─── Health check ─────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('should return 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

// ─── SubscriptionConfirmation ─────────────────────────────────────────────────

describe('POST /webhook - SubscriptionConfirmation', () => {
  it('confirms subscription and returns 200', async () => {
    axios.get.mockResolvedValueOnce({ status: 200 });

    const body = makeSnsBody('SubscriptionConfirmation', {
      SubscribeURL: 'https://sns.amazonaws.com/confirm?token=abc',
    });

    const res = await request(app).post('/webhook').send(body);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Subscription confirmed');
    expect(axios.get).toHaveBeenCalledWith('https://sns.amazonaws.com/confirm?token=abc');
  });

  it('returns 400 when SubscribeURL is missing', async () => {
    const body = makeSnsBody('SubscriptionConfirmation');
    const res = await request(app).post('/webhook').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/SubscribeURL/);
  });

  it('returns 500 when the SubscribeURL request fails', async () => {
    axios.get.mockRejectedValueOnce(new Error('network error'));

    const body = makeSnsBody('SubscriptionConfirmation', {
      SubscribeURL: 'https://sns.amazonaws.com/confirm?token=abc',
    });

    const res = await request(app).post('/webhook').send(body);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/confirm subscription/);
  });
});

// ─── UnsubscribeConfirmation ──────────────────────────────────────────────────

describe('POST /webhook - UnsubscribeConfirmation', () => {
  it('acknowledges unsubscribe and returns 200', async () => {
    const body = makeSnsBody('UnsubscribeConfirmation');
    const res = await request(app).post('/webhook').send(body);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Unsubscribe acknowledged');
  });
});

// ─── Notification / SES events ───────────────────────────────────────────────

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

describe('POST /webhook - Notification (SES events)', () => {
  SES_EVENT_TYPES.forEach((eventType) => {
    it(`processes ${eventType} event and returns 200`, async () => {
      const body = makeSesNotificationBody(eventType);
      const res = await request(app).post('/webhook').send(body);
      expect(res.status).toBe(200);
      expect(res.body.eventType).toBe(eventType);
    });
  });

  it('returns 400 when Message field is missing', async () => {
    const body = makeSnsBody('Notification');
    const res = await request(app).post('/webhook').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Message/);
  });

  it('returns 400 when Message is not valid JSON', async () => {
    const body = makeSnsBody('Notification', { Message: 'not-json' });
    const res = await request(app).post('/webhook').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/parse/i);
  });

  it('returns 422 when eventType is unknown', async () => {
    const body = makeSnsBody('Notification', {
      Message: JSON.stringify({ eventType: 'UnknownEvent' }),
    });
    const res = await request(app).post('/webhook').send(body);
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Unknown SES event type/);
  });

  it('returns 422 when eventType is missing', async () => {
    const body = makeSnsBody('Notification', {
      Message: JSON.stringify({ mail: { messageId: 'abc' } }),
    });
    const res = await request(app).post('/webhook').send(body);
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/eventType/);
  });

  it('supports legacy notificationType field', async () => {
    const sesEvent = { notificationType: 'Bounce', bounce: {} };
    const body = makeSnsBody('Notification', { Message: JSON.stringify(sesEvent) });
    const res = await request(app).post('/webhook').send(body);
    expect(res.status).toBe(200);
    expect(res.body.eventType).toBe('Bounce');
  });
});

// ─── General validation ───────────────────────────────────────────────────────

describe('POST /webhook - general validation', () => {
  it('returns 400 for unsupported message type', async () => {
    const body = makeSnsBody('SomeUnsupportedType');
    const res = await request(app).post('/webhook').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported SNS message type/);
  });

  it('returns 400 when body has no Type field', async () => {
    const res = await request(app).post('/webhook').send({ foo: 'bar' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/SNS message type/);
  });

  it('reads message type from x-amz-sns-message-type header', async () => {
    const body = makeSnsBody('UnsubscribeConfirmation');
    delete body.Type;

    const res = await request(app)
      .post('/webhook')
      .set('x-amz-sns-message-type', 'UnsubscribeConfirmation')
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Unsubscribe acknowledged');
  });
});
