import type { ClientMessage } from './protocol';

/**
 * The messages a browser client sends, built in one place.
 *
 * ## Why this module exists
 *
 * The client and the server each had their own idea of the wire format and
 * nothing compared them. `use-sentinel-ws.ts` sent `{ action: 'subscribe' }`
 * while `parseClientMessage` reads `type`, so **every subscribe was rejected**
 * with `UNKNOWN_MESSAGE_TYPE` and no topic was ever registered. Six components
 * used that hook.
 *
 * The fault stayed invisible because the server also ran an unconditional
 * firehose that pushed raw events to every connection regardless of
 * subscription: clients saw traffic, so the feed looked alive while per-topic
 * delivery was entirely dead. Removing the firehose without fixing the shape
 * would have taken the feed dark instead.
 *
 * Building the messages here means the hook and the server's parser can be
 * tested against the same values — see `__tests__/client-messages.test.ts`,
 * which round-trips each one through `parseClientMessage`. A typo in the shape
 * now fails a test rather than silently disabling the feed.
 */

export function subscribeMessage(topics: string[]): ClientMessage {
  return { type: 'subscribe', topics };
}

export function unsubscribeMessage(topics: string[]): ClientMessage {
  return { type: 'unsubscribe', topics };
}

export function pingMessage(): ClientMessage {
  return { type: 'ping' };
}

/** Serialises a client message for `socket.send`. */
export function encodeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}
