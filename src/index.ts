/**
 * BONGHOEY PAY-PER-PROMPT AI BOT
 * Architecture: Cloudflare Worker + KV + Native Workers AI
 */

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  BONGHOEY_WEBHOOK_SECRET: string;
  BONGHOEY_MERCHANT_LINK: string;
  BONGHOEY_KV: KVNamespace; 
  AI: any; // Native Cloudflare AI Binding
}

const DEV_SYSTEM_PROMPT = `You are an elite, highly intelligent AI assistant. The user has paid for this specific response, so your answer must be exceptionally high-quality, accurate, and immediately useful.

CRITICAL RULES:
1. NO FLUFF: Do not use robotic filler phrases like "Sure, I can help with that," "Here is the information," or "In conclusion." Start your answer immediately.
2. TELEGRAM FORMATTING: Use Markdown to make your answer highly readable. Use **bolding** for emphasis, bullet points for lists, and \`inline code\` for technical terms.
3. ADAPTIVE TONE: If the user asks a technical question, act as a Senior Architect. If they ask a general question, act as a subject-matter expert. 
4. CONCISENESS: Respect the user's time. Be comprehensive but do not ramble.`;

export default {
  // FIXED: Added ctx: ExecutionContext
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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
          `🤖 *Welcome to Pay-Per-Prompt AI (Sample for Testing)*\n\n` +
          `Ask anything for only 100 KHR!\n\n` +
          `1️⃣ Click the link below\n` +
          `2️⃣ Pay at https://pay.ababank.com/oRF8/4mdpgxm7 (For testing purpose and No refund) & upload your receipt\n` +
          `3️⃣ **Type your question** in the "សំណួរ" field\n\n` +
          `🧑‍💻 **Source Code** https://github.com/sengtha/bonghoey-pay-per-prompt/\n\n` +
          `👉 [Pay & Ask Question](${payLink})`;

        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, welcomeMessage, true);
      }
      return new Response("OK");
    }

    // =========================================================
    // ROUTE 2: BongHoey Webhook Handler
    // =========================================================
    if (url.pathname === "/api/bonghoey-webhook" && request.method === "POST") {
      
      const signature = request.headers.get("x-bonghoey-signature");
      if (!signature) {
        return new Response("Missing Signature", { status: 401 });
      }

      const rawBody = await request.text();
      const isValid = await verifyBonghoeySignature(env.BONGHOEY_WEBHOOK_SECRET, rawBody, signature);
      if (!isValid) {
        console.error("❌ Invalid Webhook Signature!");
        return new Response("Unauthorized", { status: 401 });
      }

      console.log("✅ Webhook is Authentic!");

      const payload: any = JSON.parse(rawBody);
      const transactionId = payload.transaction_id || payload.id; 
      const eventType = payload.event;

      // --- EVENT: Receipt Uploaded ---
      if (eventType === "receipt.paid") {
        const chatId = payload.metadata;
        const question = payload.sender_input;

        if (transactionId && chatId && question) {
          await env.BONGHOEY_KV.put(
            transactionId, 
            JSON.stringify({ chatId, question }), 
            { expirationTtl: 86400 } 
          );
          await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⏳ Receipt received! Verifying your payment...", false);
        }
        return new Response("Data cached", { status: 200 });
      }

      // --- EVENT: Payment Verified ---
      if (eventType === "receipt.verified") {
        if (!transactionId) return new Response("Missing ID", { status: 400 });

        const cachedDataStr = await env.BONGHOEY_KV.get(transactionId);
        
        if (!cachedDataStr) {
          return new Response("Session expired", { status: 404 });
        }

        const { chatId, question } = JSON.parse(cachedDataStr);

        // Agnostic model messaging
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "✅ Payment Verified! The AI is analyzing your question...", false);

        ctx.waitUntil((async () => {
          // CRITICAL FIX: Delete from KV immediately to prevent stuck keys on AI timeout
          await env.BONGHOEY_KV.delete(transactionId);

          try {
            const answer = await callWorkersAI(question, env);
            
            // Try sending with Markdown formatting first
            const success = await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `🧠 **Answer:**\n\n${answer}`, true);
            
            // If Telegram rejects the markdown formatting, fallback to plain text
            if (!success) {
               console.log("Markdown failed, falling back to plain text...");
               await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `🧠 Answer:\n\n${answer}`, false);
            }

          } catch (error) {
            console.error("[AI ERROR]", error);
            await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "❌ Sorry, the AI encountered a timeout or processing error.", false);
          }
        })());

        return new Response("Processed successfully", { status: 200 });
      }

      return new Response("Event ignored", { status: 200 });
    }

    return new Response("Webhook active.");
  }
};

/**
 * HELPER: Verify HMAC SHA256 Signature using native Web Crypto API
 */
async function verifyBonghoeySignature(secret: string, rawBody: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const generatedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return generatedSignature === signature;
}

/**
 * HELPER: Call Cloudflare Workers AI natively
 */
async function callWorkersAI(userPrompt: string, env: Env) {
  // Update this string to easily swap models globally
  const modelToUse = '@cf/moonshotai/kimi-k2.6'; 

  const aiResponse: any = await env.AI.run(modelToUse, {
    messages: [
      { role: "system", content: DEV_SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ]
  });

  // Safely extract the text: 
  // 1. Try the new OpenAI-compatible format (used by modern models)
  // 2. Fall back to the legacy Cloudflare format (used by older models)
  const answer = aiResponse.choices?.[0]?.message?.content || aiResponse.response;

  return answer || "No response generated.";
}

/**
 * HELPER: Send Telegram Message (Now with Error Handling & Markdown Toggle)
 */
async function sendTelegramMessage(token: string, chatId: string | number, text: string, useMarkdown = false): Promise<boolean> {
  const payload: any = { 
    chat_id: chatId, 
    text: text 
  };
  
  if (useMarkdown) {
    payload.parse_mode = "Markdown";
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("Telegram API Rejected Message:", errorText);
      return false; // Tells the main loop to try again without Markdown
    }
    return true;
  } catch (err) {
    console.error("Failed to reach Telegram:", err);
    return false;
  }
}
