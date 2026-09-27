# Copilot pilot: activation and verification

The authenticated `/ai` workspace and Discover/Trade Copilot panel use the official Google GenAI SDK on the server. The old preview endpoints return `410`; their template gateway is test-only. No private portfolio or transaction-execution tool is registered.

## Activation

1. Apply `npm run db:migrate`. Migration `036_ai_copilot_pilot` adds conversations, observations and actual usage fields. It was applied to the configured development database during this implementation.
2. Use a dedicated Gemini project without paid billing. An API key alone does **not** prove that calls are free. Sentinel never upgrades billing or selects a fallback model, but cannot inspect the project's billing status: the owner must verify it before enabling.
3. Configure these server-only variables in `.env` or the deployment secret store:

   ```dotenv
   GEMINI_API_KEY=your-local-secret
   GEMINI_MODEL=gemini-3.8-flash
   AI_PILOT_ENABLED=true
   AI_FREE_TIER_CONFIRMED=true
   AI_COPILOT_ACCESS=invited
   AI_PILOT_USER_IDS=exact-owner-user-id,exact-invited-user-id
   AI_MODEL_RPM=confirmed-project-limit
   AI_MODEL_TPM=confirmed-project-limit
   AI_MODEL_RPD=confirmed-project-limit
   ```

   Replace quota placeholders with positive integers from AI Studio; do not guess. Check that the configured model is available to that project. Keep the pilot disabled until these checks are complete. Never use `NEXT_PUBLIC_` for any of these variables. Restart the server after changing environment values.

   For public availability to all signed-in Sentinel accounts, use `AI_COPILOT_ACCESS=authenticated`; the allowlist is then not required. Anonymous visitors cannot generate answers. Keep the same per-account and project budgets: public availability does not increase free-tier capacity. Paid models and automatic paid fallback remain unimplemented. The owner confirmed free-tier usage, but actual quota values and the public sign-in policy still need confirmation before activation.
4. Both PostgreSQL and Redis must be reachable. AI quota checks fail closed without Redis; they never use the general cache's process-local fallback. Use a real signed session, not the application's legacy development demo token. Cookie and wallet sign-in paths are supported.
5. Run the live evaluation below as the owner before inviting testers. The frontend can show setup or invite-only states without making model calls.

## Runtime boundaries

- Per generation: at most four model requests, eight read-only tool calls and a 45-second generation deadline. Client cancellation stops further work; requests already accepted by the external service may still consume quota.
- One active project generation. Ten answers per tester and twenty per project daily. Atomic Redis counters additionally enforce configured model RPM/TPM/RPD. Token reservation deliberately overestimates usage; actual returned token counts are stored separately. Application daily limits reset in UTC; model daily counters follow Pacific time.
- No key rotation, paid fallback, provider auto-upgrade, arbitrary URL fetching, shell, SQL, wallet-account, signing or broadcasting tool.
- Questions are screened before storage and outbound calls. The free-tier privacy notice and filters are defense in depth, **not comprehensive personal-data detection**. Users must not enter personal, sensitive, confidential, or wallet-ownership information.
- Raw token metadata is not included in model prompts. Tool inputs use exact mints and strict schemas. Public numerical cards are rendered from evidence, never model-generated numbers.
- The model selects tools and chooses relevant application-validated explanations. It cannot publish unrestricted financial prose merely by attaching a valid citation. Unknown insights fall back to measured evidence without AI interpretation. This conservative pilot intentionally favors verifiability over open-ended commentary.
- Chart indicators use measured USD candles. EMA/Bollinger require sufficient contiguous history; RSI uses Wilder smoothing. Missing bars are not padded. MCAP is not substituted for USD analysis.
- Historical comparison needs actual stored observations around the requested time. New installations will honestly report insufficient history until observations accumulate. Creator history reports recorded counts, not inferred identities or rug accusations.
- Trade preparation is only a link to the existing order form; amounts and quotes never enter the model payload.
- Conversations are owner-scoped, expire after thirty days, and become inaccessible immediately on expiry. Deletion cascades immediately. The custom server starts an hourly retention sweep; request-time cleanup is a backup. Backups must have an independently configured retention policy. Public observation snapshots have no user association.
- Internal logs contain support references and neutral error categories, not prompts, credentials or upstream error bodies. Usage records contain actual counts when returned; interrupted provider requests may not return usage. A missing grounding score is stored as SQL `NULL`, not a simulated confidence value.

## Verification

```text
npx vitest run lib/ai/__tests__
npx tsc --noEmit --pretty false
npm run lint
npm run build
node scripts/copilot-ui-qa.cjs
```

The browser harness uses **intercepted test fixtures**, not a live Gemini response, and never submits transactions. It covers all four requested viewports, public-data consent, privacy rejection, evidence, cancellation, quota errors, deletion and dialog keyboard focus. Screenshots and the report are in `artifacts/copilot/` (ignored by Git).

`lib/ai/pilot/evaluation-cases.json` contains forty representative live model-selection/privacy cases. Unit tests and mocked SDK loops do not establish real model tool-selection accuracy.

To evaluate after owner activation, set `AI_EVAL_SESSION_TOKEN` locally to a real owner's signed session (never commit or share it), then run explicit cases:

```text
node scripts/copilot-model-eval.cjs --run pilot-01 pilot-02
```

This calls the ordinary authenticated endpoint and reads only the resulting internal usage record for scoring. It preserves all quotas and stops on exhausted quota or missing access. Run remaining cases across permitted daily budgets; do not raise quotas or rotate keys to rush testing. The accumulated report stays in `artifacts/copilot/live-evaluation.json`. Require all forty cases to run, all privacy cases to pass, and at least ninety percent correct, successful tool selection before tester rollout. Review factual cards and qualitative conclusions manually as well. Live evaluation remains pending until model access and quotas are confirmed.

To disable: set `AI_PILOT_ENABLED=false` and restart. No chart, discovery lifecycle, provider-priority or execution setting needs to change.

## Public-release caveats

The dependency audit currently reports twenty advisories, including a critical advisory for the existing Next.js dependency. Resolve dependency security upgrades before a public production rollout; this Copilot implementation did not perform a framework upgrade. Lint also reports two existing chart hook-dependency warnings outside the Copilot changes. Neither passing mocked tests nor a successful build establishes a production model accuracy SLA.
