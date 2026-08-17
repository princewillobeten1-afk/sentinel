import { NotificationJob, NotificationChannel } from './types';

export async function dispatchToChannel(job: NotificationJob): Promise<void> {
  switch (job.channel) {
    case NotificationChannel.IN_APP:
      return dispatchInApp(job);
    case NotificationChannel.PUSH:
      return dispatchPush(job);
    case NotificationChannel.EMAIL:
      return dispatchEmail(job);
    case NotificationChannel.TELEGRAM:
      return dispatchTelegram(job);
    case NotificationChannel.DISCORD:
      return dispatchDiscord(job);
    case NotificationChannel.WEBHOOK:
      return dispatchWebhook(job);
    default:
      throw new Error(`Unsupported channel: ${job.channel}`);
  }
}

async function dispatchInApp(job: NotificationJob): Promise<void> {
  // In-app just means it's available in the DB for the API to fetch.
  // Real implementation might push via WebSockets here.
  console.log(`[IN_APP] Pushed event ${job.eventId}`);
}

async function dispatchPush(job: NotificationJob): Promise<void> {
  console.log(`[PUSH] Sent push notification for ${job.eventId} via ${job.provider}`);
}

async function dispatchEmail(job: NotificationJob): Promise<void> {
  console.log(`[EMAIL] Sent email for ${job.eventId} via ${job.provider}`);
}

async function dispatchTelegram(job: NotificationJob): Promise<void> {
  console.log(`[TELEGRAM] Sent telegram message for ${job.eventId} via ${job.provider}`);
}

async function dispatchDiscord(job: NotificationJob): Promise<void> {
  console.log(`[DISCORD] Sent discord message for ${job.eventId} via ${job.provider}`);
}

async function dispatchWebhook(job: NotificationJob): Promise<void> {
  console.log(`[WEBHOOK] Posted webhook for ${job.eventId} via ${job.provider}`);
  // Implementation should include HMAC signatures for security
}
