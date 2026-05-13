# 🤖 BongHoey Pay-Per-Prompt AI Bot

A production-ready sample project demonstrating how to monetize AI prompts using the [BongHoey](https://bonghoey.io/) Payment platform, Telegram, and Cloudflare's native Workers AI.

This project uses Cloudflare KV to temporarily hold user queries until payment is verified via KHQR, keeping your infrastructure completely serverless.

## 🌟 Features
* **Zero Database:** Uses Cloudflare KV to store prompts temporarily.
* **Native Workers AI:** Runs Google's Gemma model directly on Cloudflare's edge network—no external API keys required.
* **Pay-Per-Prompt:** Users pay exactly 100 or any amount in KHR or USD per question automatically.

---

## 🚀 Quick Deploy Guide

### Step 1: Create your Telegram Bot
1. Open Telegram and search for **[@BotFather](https://t.me/botfather)** (look for the verified blue checkmark).
2. Send the command `/newbot` to start the setup process.
3. Follow the prompts to give your bot a **Name** and a **Username** (must end in `bot`, e.g., `BongHoeyAIBot`).
4. BotFather will generate an **HTTP API Token** (it looks like `1234567890:ABCDefGhiJkLmnOpQrSTuvwXyz`). 
5. Copy this token—you will need it for your Cloudflare settings!

### Step 2: Create a Cloudflare KV Namespace
1. Go to your Cloudflare Dashboard -> ** Storage & Databases ** -> **Workers KV**.
2. Create a new namespace named `BONGHOEY_KV`.
3. Copy its **ID** and paste it into the `wrangler.toml` file in this repository.

### Step 3: Deploy to Cloudflare
Deploy this project to Cloudflare via GitHub integration or the command line. Once your worker is deployed, it will have a URL like `https://your-bot-name.your-subdomain.workers.dev`.

### Step 4: Set Up Environment Variables
Go to your deployed Worker in the Cloudflare Dashboard -> **Settings** -> **Variables and Secrets**, and add the following:
* `TELEGRAM_BOT_TOKEN`: The API token you got from @BotFather in Step 1.
* `BONGHOEY_WEBHOOK_SECRET`: Your webhook secret key from your BongHoey Merchant Panel.
* `BONGHOEY_MERCHANT_LINK`: Set https://bonghoey.io/

### Step 5: Connect the Webhooks
For the bot to work, both Telegram and BongHoey need to know where to send data.

**A. Connect BongHoey:**
1. Log into your BongHoey Dashboard.
2. Set your Webhook URL to: `https://<YOUR_WORKER_URL>/api/bonghoey-webhook`
3. Make sure to check the boxes for both **receipt.uploaded** and **receipt.paid**.

**B. Connect Telegram:**
Telegram requires you to manually register your webhook URL. To do this, open a new tab in your web browser and paste the following URL. Make sure to replace `<YOUR_BOT_TOKEN>` and `<YOUR_WORKER_URL>` with your actual details:

\`\`\`text
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_WORKER_URL>/api/telegram
\`\`\`

*(Example: `https://api.telegram.org/bot123456:ABCDef/setWebhook?url=https://my-bot.workers.dev/api/telegram`)*

Press Enter. If successful, you will see a screen showing `{"ok":true,"result":true,"description":"Webhook was set"}`.

---

## 🎉 You're Done!
Open your new bot in Telegram, send a message, and test your automated AI payment flow!
