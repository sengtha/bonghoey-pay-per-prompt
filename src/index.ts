/**
 * BONGHOEY PAY-PER-PROMPT AI BOT
 * Architecture: Cloudflare Worker + KV + Native Workers AI (Gemma)
 */

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  BONGHOEY_WEBHOOK_SECRET: string;
  BONGHOEY_MERCHANT_LINK: "https://bonghoey.io/";
  BONGHOEY_KV: KVNamespace; 
  AI: any; // Native Cloudflare AI Binding
}

const DEV_SYSTEM_PROMPT = `You are a highly skilled Senior Software Engineer and Architect. 
Provide concise, accurate, and production-ready technical answers. 
If writing code, include brief comments explaining the logic.`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // =========================================================
    // ROUTE 1: Telegram Entry Point
    // =========================================================
    if (url.pathname === "/api/telegram" && request.method === "POST") {
      const update: any = await request.json();
      const chatId = update.message?.chat.id;

      if (chatId) {
        const payLink = `${env.BONGHOEY_MERCHANT_LINK}?metadata=${chatId}`;
        
        const welcomeMessage = 
          `🤖 *Welcome to Pay-Per-Prompt AI*\n\n` +
          `Ask anything for only 500 KHR!\n\n` +
          `1️⃣ Click the link below\n` +
          `2️⃣ Pay & upload your receipt\n` +
          `3️⃣ **Type your question** in the "Note" field\n\n` +
          `👉 [Pay & Ask Question](${payLink})`;

        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, welcomeMessage);
      }
      return new Response("OK");
    }

    // =========================================================
    // ROUTE 2: BongHoey Webhook Handler
    // =========================================================
    if (url.pathname === "/api/bonghoey-webhook" && request.method === "POST") {
      if (request.headers.get("x-bonghoey-secret") !== env.BONGHOEY_WEBHOOK_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }

      const payload: any = await request.json();
      const transactionId = payload.transaction_id || payload.id; 
      const eventType = payload.event;

      // --- EVENT: Receipt Uploaded ---
      if (eventType === "receipt.uploaded") {
        const chatId = payload.metadata;
        const question = payload.input_text; 

        if (transactionId && chatId && question) {
          await env.BONGHOEY_KV.put(
            transactionId, 
            JSON.stringify({ chatId, question }), 
            { expirationTtl: 86400 } 
          );
          await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⏳ Receipt received! Verifying your payment...");
        }
        return new Response("Data cached", { status: 200 });
      }

      // --- EVENT: Payment Verified ---
      if (eventType === "receipt.paid" || eventType === "receipt.verified") {
        if (!transactionId) return new Response("Missing ID", { status: 400 });

        const cachedDataStr = await env.BONGHOEY_KV.get(transactionId);
        
        if (!cachedDataStr) {
          return new Response("Session expired", { status: 404 });
        }

        const { chatId, question } = JSON.parse(cachedDataStr);

        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "✅ Payment Verified! Gemma is analyzing your question...");

        try {
          // Call Cloudflare Workers AI directly
          const answer = await callWorkersAI(question, env);
          
          await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `🧠 **Gemma Answer:**\n\n${answer}`);

          // Cleanup KV to save space
          await env.BONGHOEY_KV.delete(transactionId);

        } catch (error) {
          console.error("[AI ERROR]", error);
          await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "❌ Sorry, the AI encountered an error.");
        }

        return new Response("Processed successfully", { status: 200 });
      }

      return new Response("Event ignored", { status: 200 });
    }

    return new Response("Webhook active.");
  }
};

/**
 * HELPER: Call Cloudflare Workers AI natively
 */
async function callWorkersAI(userPrompt: string, env: Env) {
  // Uses Cloudflare's hosted Gemma model (update string to exact catalog ID if needed)
  const aiResponse = await env.AI.run('@cf/google/gemma-2-9b-it', {
    messages: [
      { role: "system", content: DEV_SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ]
  });

  return aiResponse.response;
}

/**
 * HELPER: Send Telegram Message
 */
async function sendTelegramMessage(token: string, chatId: string | number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      chat_id: chatId, 
      text: text, 
      parse_mode: "Markdown" 
    })
  });
}
