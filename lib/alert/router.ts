import {
  AlertEvent,
  AlertPreferences,
  NotificationJob,
  NotificationChannel,
  AlertSeverity
} from './types';
import { dispatchToChannel } from './channels';

export class NotificationRouter {

  /**
   * Evaluates if a notification should be suppressed due to quiet hours.
   */
  public isInQuietHours(preferences: AlertPreferences): boolean {
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) return false;
    
    // In a real implementation, handle timezone conversions properly
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTime = currentHour + currentMinute / 60;

    const [startHour, startMin] = preferences.quietHoursStart.split(':').map(Number);
    const startTime = startHour + startMin / 60;

    const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number);
    const endTime = endHour + endMin / 60;

    if (startTime < endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // Wraps around midnight (e.g., 23:00 to 07:00)
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  /**
   * Routes an generated AlertEvent to NotificationJobs.
   */
  public route(event: AlertEvent, preferences: AlertPreferences, requestedChannels: NotificationChannel[]): NotificationJob[] {
    const jobs: NotificationJob[] = [];

    // Check quiet hours
    const isQuiet = this.isInQuietHours(preferences);
    const isCritical = event.severity === AlertSeverity.CRITICAL;

    if (isQuiet && (!isCritical || !preferences.overrideCritical)) {
      // Suppress notifications during quiet hours unless critical and override enabled
      // We always allow IN_APP so the user sees it when they open the app.
      requestedChannels = [NotificationChannel.IN_APP];
    }

    for (const channel of requestedChannels) {
      // Ensure user has enabled this channel in preferences (unless it's IN_APP)
      if (channel !== NotificationChannel.IN_APP && !preferences.channels[channel]) {
        continue;
      }

      jobs.push({
        id: crypto.randomUUID(),
        eventId: event.id,
        channel,
        provider: this.getProviderForChannel(channel),
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return jobs;
  }

  private getProviderForChannel(channel: NotificationChannel): string {
    switch (channel) {
      case NotificationChannel.EMAIL: return 'sendgrid';
      case NotificationChannel.PUSH: return 'fcm';
      case NotificationChannel.TELEGRAM: return 'telegram_bot';
      case NotificationChannel.DISCORD: return 'discord_webhook';
      case NotificationChannel.WEBHOOK: return 'custom_webhook';
      default: return 'internal';
    }
  }

  /**
   * Process pending jobs in the queue
   */
  public async processQueue(jobs: NotificationJob[]): Promise<void> {
    for (const job of jobs) {
      if (job.status !== 'PENDING' && job.status !== 'RETRY') continue;

      try {
        job.attempts += 1;
        await dispatchToChannel(job);
        job.status = 'SUCCESS';
      } catch (error: any) {
        if (job.attempts >= job.maxAttempts) {
          job.status = 'FAILED';
          job.errorMessage = error.message;
        } else {
          job.status = 'RETRY';
          // Exponential backoff
          job.nextRetryAt = new Date(Date.now() + Math.pow(2, job.attempts) * 1000 * 60);
        }
      }
      job.updatedAt = new Date();
    }
  }
}
