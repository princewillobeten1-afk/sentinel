# 03 — API Gateway, Edge Layer & Security Boundaries (Sprint 34 §10-14, §80-83)

## 1. Edge Layer Protection
Traffic enters through a globally distributed Edge/CDN perimeter (Cloudflare / AWS CloudFront):
- **WAF Rules**: Automatic mitigation of OWASP Top 10 vulnerabilities (SQLi, XSS, SSRF).
- **DDoS Shield**: L3/L4 volumetric attack absorption and L7 bot rate dampening.
- **TLS 1.3 Termination**: Strict HSTS (`max-age=63072000; includeSubDomains; preload`) with automated cert rotation.
- **Geo-Routing & Static Asset Caching**: Sub-20ms edge delivery of Next.js static bundles and UI assets.

---

## 2. API Gateway Responsibilities
The Sentinel API Gateway serves as the single reverse-proxy entrypoint to backend services:
- **Authentication**: Validates Bearer JWTs, SIWS cryptographic signatures, and API keys.
- **Scope & RBAC Enforcement**: Checks token permissions (`trading:execute`, `portfolio:read`, `admin:super`).
- **Rate Limiting Engine**:
  - `Public Tiers`: 60 requests/minute per IP (sliding window Redis counter).
  - `Authenticated Users`: 300 requests/minute per user ID.
  - `API Key Traders`: Up to 2,400 requests/minute with custom burst quotas.
- **Idempotency & Concurrency Lock**: Inspects `Idempotency-Key` header on financial POST/PUT routes; prevents race conditions and double-submits.
- **Request Tracing**: Injects unique `X-Request-ID` and OpenTelemetry `traceparent` headers into downstream context.
- **RFC 8594 API Deprecation**: Returns `Deprecation`, `Sunset`, and `Link` headers for deprecated endpoints.

---

## 3. Network Segmentation & Zero-Trust Boundary

```text
PUBLIC INTERNET
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│ EDGE / CDN / WAF PERIMETER                              │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│ API GATEWAY (DMZ Network)                               │
└─────────────────────────────────────────────────────────┘
      │ (mTLS / Internal HMAC)
      ▼
┌─────────────────────────────────────────────────────────┐
│ PRIVATE APPLICATION SERVICES (VPC Private Subnet)       │
│ • Trading API   • Risk Engine   • Portfolio Service     │
└─────────────────────────────────────────────────────────┘
      │ (Private Network Only)
      ▼
┌─────────────────────────────────────────────────────────┐
│ PRIVATE DATA PLATFORM (VPC Isolated Subnet)             │
│ • PostgreSQL (Encrypted at rest)                        │
│ • Redis Cluster (mTLS auth required)                    │
│ • ClickHouse OLAP Cluster                               │
└─────────────────────────────────────────────────────────┘
```
- **Zero-Trust Rule**: Internal services authenticate all inter-service RPC calls using signed JWTs or mTLS certificates. Private network location alone is never treated as sufficient authorization.
