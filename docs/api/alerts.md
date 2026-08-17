# Alerts

There is no separate "alert subscription" resource in this API. A
[webhook](./webhooks.md)'s own `eventTypes` list, set when you create it,
**is** the subscription — `webhookStore.listActiveSubscribers(eventType)`
fans an event out to every active webhook subscribed to that type. Building
a parallel subscription entity on top of that would just duplicate it, so
there isn't one.

To receive alerts, [create a webhook](./webhooks.md#create-a-webhook)
subscribed to the event types you care about.

## What's wired end-to-end

Exitability is the one domain bridged all the way to delivery this sprint:
every call to `GET /api/v1/exitability/:chain/:token` runs the real alert
generator (`buildExitabilityAlertEvents`) and broadcasts any resulting
events to subscribed webhooks (`lib/alerts/dispatch.ts`). The mapping:

| Exitability alert | Webhook event type |
|---|---|
| `EXITABILITY_DROP` | `token.exitability_dropped` |
| `STRESS_EXITABILITY_DROP` | `token.exitability_dropped` |
| `LIQUIDITY_DROP` | `token.liquidity_changed` |
| `LARGE_LIQUIDITY_WITHDRAWAL` | `token.liquidity_changed` |
| `EXIT_DEPTH_COLLAPSE` | `token.liquidity_changed` |
| `SLIPPAGE_SPIKE` | `token.risk_changed` |
| `POOL_CONCENTRATION_CHANGE` | `token.risk_changed` |

## What isn't wired yet

`lib/activity/alert-events.ts` and `lib/portfolio/alert-events.ts` generate
real alert events too, but aren't bridged to webhook delivery this pass —
kept out of scope to bound the sprint. The pattern in
`lib/alerts/dispatch.ts` generalizes to them without a redesign: adapt their
event shape to `WebhookEvent` (the way `lib/webhooks/events.ts` does for
exitability) and call `broadcastEvent()`.

There's also a separate, older, UI-facing "alert center" feature
(`app/api/v1/alerts/**`, `components/views/alert-center-view.tsx`) — an
in-app notification inbox with its own severity/read-state model. That's a
different concept from this developer-platform alerting and was
deliberately left untouched this sprint: rewiring it onto the API gateway
would have changed its response shape and broken the existing UI that
already consumes it.
