# Vercel Deployment Guide — Project Sentinel

This guide provides the complete setup for deploying Project Sentinel to [Vercel](https://vercel.com) via GitHub integration with automatic CI/CD.

---

## 1. Prerequisites

- Project Sentinel GitHub repository: [`https://github.com/princewillobeten1-afk/sentinel`](https://github.com/princewillobeten1-afk/sentinel)
- A Vercel account ([vercel.com/signup](https://vercel.com/signup))

---

## 2. Step-by-Step Vercel Setup

1. **Open Vercel New Project**:
   - Navigate to [vercel.com/new](https://vercel.com/new).
   - Under **Import Git Repository**, find `sentinel` (or search `princewillobeten1-afk/sentinel`) and click **Import**.

2. **Project Configuration**:
   - **Project Name**: `sentinel` (or your preferred name)
   - **Framework Preset**: `Next.js` (automatically detected)
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `next build` (leave default)
   - **Output Directory**: `.next` (leave default)
   - **Install Command**: `npm install` (leave default)

---

## 3. Environment Variables

Expand the **Environment Variables** section in the Vercel import screen. Add the following keys:

### Essential Variables

| Variable Name | Example / Recommended Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SOLANA_NETWORK` | `solana:devnet` *(or `solana:mainnet`)* | Network mode for wallet adapter |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Public or RPC fallback for browser adapter |
| `SOLANA_TRADING_ENABLED` | `true` | Enables Jupiter swap & trading execution |
| `HELIUS_API_KEY` | *(Your Helius API Key)* | Used for high-throughput Solana RPC queries |
| `HELIUS_RPC_URL` | `https://mainnet.helius-rpc.com/?api-key=<YOUR_KEY>` | Primary RPC for live balance and on-chain lookups |
| `AUTH_JWT_SECRET` | *(32+ character random string)* | Secret for signing SIWS auth tokens |
| `MARKET_STREAM_ENABLED` | `false` | Disabled on Vercel serverless (avoids background daemon timeout) |

### Optional / External Integrations

| Variable Name | Example / Recommended Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://...` | Connection string to cloud Postgres (Neon / Supabase). If omitted, falls back to in-memory mode. |
| `BIRDEYE_API_KEY` | *(Your Birdeye API Key)* | Market data and price history fallback |
| `QUICKNODE_SOLANA_RPC_URL` | *(Your QuickNode HTTPS Endpoint)* | Redundant Solana RPC provider |
| `RUGCHECK_API_KEY` | *(Your Rugcheck API Key)* | Token audit & LP lock reports |

> **Tip for Database on Vercel**: You can navigate to the **Storage** tab in your Vercel project, click **Create Database** $\rightarrow$ **Postgres (Neon)**, and Vercel will automatically inject `DATABASE_URL` and connection variables for you.

---

## 4. Deploy

1. Click **Deploy**.
2. Vercel will clone the repo, run `next build`, and deploy the serverless lambdas and static edge assets.
3. Once finished, you will receive a production URL (e.g., `https://sentinel-xxx.vercel.app`).
4. Any future `git push origin main` will trigger an automated production deployment.
