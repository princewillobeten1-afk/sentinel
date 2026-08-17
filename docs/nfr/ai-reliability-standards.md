# Project Sentinel: AI Reliability, Explainability & Versioning Standards (Sprint 33 §29-34)

## 1. Separation of Verified Facts vs. AI Inferences (Sprint 33 §29)
The user interface and backend APIs must strictly distinguish immutable blockchain facts from statistical AI interpretations:
- **Verified Fact**: "Creator wallet sold 420,000 SOL of token supply at slot 289104000."
- **AI Interpretation**: "This pattern is historically correlated with elevated pre-rug risk (82% probability)."

These two categories must never be presented as equivalent.

## 2. Transparent Explainability (Sprint 33 §30)
Every AI risk score or recommendation must expose its concrete contributing factors:
- Positive Factors: (e.g. `✓ Liquidity locked in Meteora vault for 365 days`, `✓ Mint authority revoked`).
- Warning Factors: (e.g. `⚠ Creator retains 31% supply across 3 clustered wallets`, `⚠ 0% organic liquidity`).

## 3. Failure Resilience: Never Fabricate (Sprint 33 §31)
If an upstream AI model times out or is offline:
- Display explicit **"AI analysis unavailable"** status.
- Never output synthetic, hallucinatory, or placeholder risk scores.
- Continue serving verified on-chain facts and allowing safe trading where appropriate.

## 4. Model Versioning & Audit Trail (Sprint 33 §33-34)
Every AI inference emitted in production must record:
- `modelVersion`: e.g. `sentinel-risk-model-v2.4`
- `promptVersion`: e.g. `prompt-risk-eval-v1.8`
- `dataSnapshotHash`: Deterministic hash of input parameters.
- `confidencePct`: Explicit numeric confidence metric (0–100%).
- `timestamp`: UTC ISO 8601 timestamp.
