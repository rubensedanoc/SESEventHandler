# SESEventHandler

A lightweight Node.js/Express service that captures **Amazon SES events** delivered by **Amazon SNS** via a POST webhook.

## How it works

Amazon SNS sends HTTP POST requests to the `/webhook` endpoint. This service handles:

| SNS Message Type         | Behaviour                                                      |
|--------------------------|----------------------------------------------------------------|
| `SubscriptionConfirmation` | Automatically confirms the SNS subscription by visiting `SubscribeURL` |
| `Notification`           | Parses the embedded SES event and processes it                 |
| `UnsubscribeConfirmation` | Acknowledges gracefully                                       |

### Supported SES event types

`Bounce` · `Complaint` · `Delivery` · `Send` · `Reject` · `Open` · `Click` · `RenderingFailure` · `DeliveryDelay`

## Getting started

### Prerequisites

- Node.js 18+

### Installation

```bash
npm install
```

### Running the server

```bash
npm start          # starts on port 3000 by default
PORT=8080 npm start  # custom port
```

### Running tests

```bash
npm test
```

## Endpoints

### `GET /health`

Returns `200 OK` with `{ "status": "ok" }`.

### `POST /webhook`

Receives SNS notifications. Set this URL as the SNS subscription endpoint.

**Headers** (set by SNS automatically):

| Header | Value |
|---|---|
| `x-amz-sns-message-type` | `SubscriptionConfirmation` / `Notification` / `UnsubscribeConfirmation` |
| `Content-Type` | `text/plain` or `application/json` |

## AWS setup

1. Create an **SNS topic**.
2. Configure **Amazon SES** to publish events to the SNS topic (via Configuration Sets).
3. Add an **HTTPS subscription** to the topic pointing to `https://<your-host>/webhook`.
4. SNS will POST a `SubscriptionConfirmation` — the service confirms it automatically.
5. SES events start flowing in as `Notification` messages.
