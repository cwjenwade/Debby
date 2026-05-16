import { messagingApi, validateSignature } from "@line/bot-sdk";
import { kv } from "@vercel/kv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Helper to clean env vars
const clean = (val) => (val || "").replace(/^["']|["']$/g, "").trim();

const config = {
  channelAccessToken: clean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
  channelSecret: clean(process.env.LINE_CHANNEL_SECRET),
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken,
});

export const endpointConfig = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  // GET request for basic connectivity check
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "Debby Webhook (v2.1)",
      config: {
        hasAccessToken: !!config.channelAccessToken,
        accessTokenLength: config.channelAccessToken.length,
        hasChannelSecret: !!config.channelSecret,
        channelSecretLength: config.channelSecret.length,
      },
      hint: "If secret length is ~170, you probably swapped it with the access token. Secret should be 32 chars."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const signature = req.headers["x-line-signature"];
    const rawBody = await getRawBody(req);

    if (rawBody.length === 0) {
      console.log("Empty body received");
      return res.status(200).json({ ok: true, message: "Empty body" });
    }

    // Use rawBody (Buffer) directly for signature validation
    if (!signature || !validateSignature(rawBody, config.channelSecret, signature)) {
      console.error(`Signature validation failed. Body length: ${rawBody.length}, Secret length: ${config.channelSecret.length}`);
      return res.status(401).json({ error: "Invalid signature" });
    }

    const body = JSON.parse(rawBody.toString("utf-8"));
    const events = body.events || [];

    for (const event of events) {
      await handleEvent(event);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook Error:", err);
    // Returning 500 to help with debugging via Vercel logs
    return res.status(500).json({ error: err.message });
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
    console.error("Event Handling Error:", err);
    throw err;
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
    console.error("Load keywords error:", err);
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
    console.warn(`Node data missing: story:${storyId}:node:${nodeId}`);
    return await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: `抱歉，故事內容（${nodeId}）還沒準備好。` }],
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
          label: (rd.optionA.label || "選擇 A").substring(0, 20),
          data: `action=goto&storyId=${storyId}&nodeId=${rd.optionA.targetNodeId}`,
          displayText: rd.optionA.label || "選擇 A",
        });
      }
      if (rd.optionB?.targetNodeId) {
        actions.push({
          type: "postback",
          label: (rd.optionB.label || "選擇 B").substring(0, 20),
          data: `action=goto&storyId=${storyId}&nodeId=${rd.optionB.targetNodeId}`,
          displayText: rd.optionB.label || "選擇 B",
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
      actions.push({
        type: "postback",
        label: "看細節",
        data: "action=noop",
      });
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
        template: {
          type: "carousel",
          columns: columns.slice(0, 10),
        },
      },
    ],
  });
}
