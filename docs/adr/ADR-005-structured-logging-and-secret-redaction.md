# ADR-005: Machine-Readable Structured Logging and Secret Redaction

## Status
Accepted (Sprint 32)

## Context
Unstructured text logs (`console.log("something happened")`) are difficult to index in log aggregators (Datadog, Elastic, CloudWatch), lack correlation identifiers, and risk leaking sensitive secrets (Solana private keys, seed phrases, API keys, Bearer tokens).

## Decision
1. Standardize all application logging on machine-readable JSON logs emitted via `StructuredLogger`.
2. Standard fields: `timestamp` (UTC ISO 8601), `service`, `level` (`DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL`), `message`, `requestId`, `userId`, `event`, `latencyMs`, `metadata`.
3. Implement an automatic, regex-based secret scrubber (`sanitizeLogData`) that intercepts log payloads and masks private keys, mnemonics, API keys (`sk_live_...`), and authorization tokens before emission.
4. Suppress `DEBUG` logs in production to optimize log volume and reduce cloud logging costs.

## Consequences
- 100% machine-readable log ingestion for monitoring and alerting pipelines.
- Traceability across distributed microservices via `requestId`.
- Zero accidental leakage of cryptographic secrets in production log streams.
