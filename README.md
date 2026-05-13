# 🤖 BongHoey Pay-Per-Prompt AI Bot

A production-ready sample project demonstrating how to monetize AI prompts using the [BongHoey](https://bonghoey.io/) Payment platform, Telegram, and Cloudflare's native Workers AI.

This project uses Cloudflare KV to temporarily hold user queries until payment is verified via KHQR, keeping infrastructure completely serverless.

## 🌟 Features
* **Zero Database:** Uses Cloudflare KV to store prompts temporarily.
* **Native Workers AI:** Runs Google's Gemma model directly on Cloudflare's edge network—no external API keys required.
* **Pay-Per-Prompt:** Users pay 500 KHR per question automatically.

## 🚀 Quick Deploy

### 1. Create a KV Namespace
1. Go to your Cloudflare Dashboard -> **Workers & Pages** -> **KV**.
2. Create a namespace named `BONGHOEY_KV`.
3. Copy its **ID** and paste it into the `wrangler.toml` file.

### 2. Set Up Environment Variables
In your Worker's **Settings -> Variables and Secrets**, add:
* `TELEGRAM_BOT_TOKEN`: Your bot token from @BotFather.
* `BONGHOEY_WEBHOOK_SECRET`: Your webhook secret from BongHoey.
* `BONGHOEY_MERCHANT_LINK`: Your BongHoey checkout link.

### 3. Connect the Webhooks
* **BongHoey:** Set webhook URL to `https://YOUR_WORKER.workers.dev/api/bonghoey-webhook` (check "receipt.uploaded" and "receipt.paid").
* **Telegram:** Set webhook to `https://YOUR_WORKER.workers.dev/api/telegram`.
