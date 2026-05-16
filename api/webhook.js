import { messagingApi, validateSignature } from "@line/bot-sdk";
import { kv } from "@vercel/kv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper to clean env vars (removes common copy-paste errors like quotes)
const clean = (val) => (val || "").replace(/^["']|["']$/g, "").trim();

const config = {
  channelAccessToken: clean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
  channelSecret: clean(process.env.LINE_CHANNEL_SECRET),
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

export const config = {
  api: {
    bodyParser: false, // Required to handle raw body for signature validation
  },
};

// Robust raw body parser for Vercel Serverless Functions
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", (err) => reject(err));
  });
}

export default async function handler(req, res) {
  // 1. Connectivity & Diagnostic Check
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "Debby Webhook v2.2",
      diagnostics: {
        hasToken: !!config.channelAccessToken,
        tokenLength: config.channelAccessToken.length,
        hasSecret: !!config.channelSecret,
        secretLength: config.channelSecret.length,
      },
      env_check: {
        NODE_ENV: process.env.NODE_ENV,
      }
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const signature = req.headers["x-line-signature"];
    if (!signature) {
      console.warn("Missing x-line-signature header");
      return res.status(401).json({ error: "Missing signature" });
    }

    const rawBody = await getRawBody(req);
    const bodyString = rawBody.toString("utf-8");

    // 2. Signature Validation
    // validateSignature expects (body: string | Buffer, secret: string, signature: string)
    if (!validateSignature(bodyString, config.channelSecret, signature)) {
      console.error("401 Unauthorized: Signature check failed");
      console.error(`- Received Signature: ${signature.substring(0, 10)}...`);
      console.error(`- Body Length: ${rawBody.length}`);
      console.error(`- Secret Length: ${config.channelSecret.length}`);
      
      // If we are in local dev or specific debug mode, we could log more, 
      // but for security, we keep it minimal in production.
      return res.status(401).json({ error: "Invalid signature" });
    }

    const body = JSON.parse(bodyString);
    const events = body.events || [];

    // LINE "Verify" button sends a dummy request with empty events
    if (events.length === 0) {
      console.log("LINE Verification request received (0 events)");
      return res.status(200).json({ ok: true, message: "Verification success" });
    }

    // 3. Event Processing
    for (const event of events) {
      await handleEvent(event);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook Handler Error:", err.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function handleEvent(event) {
  try {
    const userId = event.source.userId;

    if (event.type === "message" && event.message.type === "text") {
      const text = event.message.text.trim();
      const keywords = await loadKeywords();

      if (keywords[text]) {
        const kw = keywords[text];
        if (kw.type === "story") {
          return await startStory(event, kw.storyId, kw.nodeId);
        } else if (kw.type === "text") {
          return await client.replyMessage({
            replyToken: event.replyToken,
            messages: [{ type: "text", text: kw.text }],
          });
        }
      }

      // Default Fallback
      return await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: `收到: ${text}。輸入「開始」閱讀故事，或「幫助」查看指令。` }],
      });
    }

    if (event.type === "postback") {
      const data = new URLSearchParams(event.postback.data);
      const action = data.get("action");
      const storyId = data.get("storyId");
      const nodeId = data.get("nodeId");

      if (action === "goto" && storyId && nodeId) {
        return await playNode(event, storyId, nodeId);
      }
    }
  } catch (err) {
    console.error("Event Processing Error:", err);
    // Don't throw, just log to prevent 500 retries from LINE
  }
}

async function loadKeywords() {
  try {
    const kvKeywords = await kv.get("debby:keywords");
    if (kvKeywords && typeof kvKeywords === "object") {
      return kvKeywords;
    }
    const kwPath = path.join(__dirname, "../data/keywords.json");
    if (fs.existsSync(kwPath)) {
      return JSON.parse(fs.readFileSync(kwPath, "utf-8"));
    }
    return {};
  } catch (err) {
    console.error("Load keywords failed:", err);
    return {};
  }
}

async function startStory(event, storyId, nodeId) {
  const userId = event.source.userId;
  await kv.set(`session:${userId}`, { storyId, nodeId });
  return await playNode(event, storyId, nodeId);
}

async function playNode(event, storyId, nodeId) {
  const userId = event.source.userId;
  const pages = await kv.get(`story:${storyId}:node:${nodeId}`);

  if (!pages || !Array.isArray(pages)) {
    console.warn(`Node missing in KV: story:${storyId}:node:${nodeId}`);
    return await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: `抱歉，故事節點（${nodeId}）資料尚未準備好。` }],
    });
  }

  await kv.set(`session:${userId}`, { storyId, nodeId });

  const columns = pages.map((p, i) => {
    const isLast = i === pages.length - 1;
    const actions = [];

    if (isLast && p.pageType === "choice") {
      const rd = p.renderData || {};
      if (rd.optionA?.targetNodeId) {
        actions.push({
          type: "postback",
          label: (rd.optionA.label || "A").substring(0, 20),
          data: `action=goto&storyId=${storyId}&nodeId=${rd.optionA.targetNodeId}`,
          displayText: rd.optionA.label || "A",
        });
      }
      if (rd.optionB?.targetNodeId) {
        actions.push({
          type: "postback",
          label: (rd.optionB.label || "B").substring(0, 20),
          data: `action=goto&storyId=${storyId}&nodeId=${rd.optionB.targetNodeId}`,
          displayText: rd.optionB.label || "B",
        });
      }
    } else if (isLast && (p.pageType === "next" || p.pageType === "monologue")) {
      const rd = p.renderData || {};
      let nextNodeId = rd.targetNodeId;
      if (!nextNodeId) {
        const match = nodeId.match(/n(\d+)/);
        if (match) nextNodeId = `n${parseInt(match[1]) + 1}`;
      }
      if (nextNodeId) {
        actions.push({
          type: "postback",
          label: (rd.nextLabel || rd.buttonLabel || "繼續").substring(0, 20),
          data: `action=goto&storyId=${storyId}&nodeId=${nextNodeId}`,
          displayText: rd.nextLabel || rd.buttonLabel || "繼續",
        });
      }
    }

    if (actions.length === 0) {
      actions.push({ type: "postback", label: "下一步", data: "action=noop" });
    }

    return {
      thumbnailImageUrl: p.imageUrl || "https://via.placeholder.com/1024x1024.png?text=Loading",
      title: (p.pageType === "dialogue" ? p.renderData?.speakerName : "").substring(0, 40),
      text: (p.renderData?.text || p.renderData?.prompt || p.renderData?.paragraphs?.[0] || "...").substring(0, 60),
      actions: actions.slice(0, 3),
    };
  });

  return await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "template",
        altText: "故事更新了",
        template: { type: "carousel", columns: columns.slice(0, 10) },
      },
    ],
  });
}
