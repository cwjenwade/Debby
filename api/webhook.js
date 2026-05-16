import { messagingApi, validateSignature } from "@line/bot-sdk";
import { kv } from "@vercel/kv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
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
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, service: "Debby webhook" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const signature = req.headers["x-line-signature"];
    const rawBody = await getRawBody(req);
    const bodyString = rawBody.toString("utf-8");

    if (!signature || !validateSignature(bodyString, config.channelSecret, signature)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const body = JSON.parse(bodyString);
    const events = body.events || [];

    for (const event of events) {
      await handleEvent(event);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
}

async function handleEvent(event) {
  const userId = event.source.userId;

  if (event.type === "message" && event.message.type === "text") {
    const text = event.message.text.trim();
    const keywords = await loadKeywords();

    if (keywords[text]) {
      const kw = keywords[text];
      if (kw.type === "story") {
        return startStory(event, kw.storyId, kw.nodeId);
      } else if (kw.type === "text") {
        return client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: "text", text: kw.text }],
        });
      }
    }

    // Default Fallback
    return client.replyMessage({
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
      return playNode(event, storyId, nodeId);
    }
  }
}

async function loadKeywords() {
  try {
    // Prioritize Vercel KV for dynamic updates
    const kvKeywords = await kv.get("debby:keywords");
    if (kvKeywords && typeof kvKeywords === "object") {
      return kvKeywords;
    }

    // Fallback to local file
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
  return playNode(event, storyId, nodeId);
}

async function playNode(event, storyId, nodeId) {
  const userId = event.source.userId;
  const pages = await kv.get(`story:${storyId}:node:${nodeId}`);

  if (!pages || !Array.isArray(pages)) {
    return client.replyMessage({
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
          label: rd.optionA.label || "選擇 A",
          data: `action=goto&storyId=${storyId}&nodeId=${rd.optionA.targetNodeId}`,
          displayText: rd.optionA.label || "選擇 A",
        });
      }
      if (rd.optionB?.targetNodeId) {
        actions.push({
          type: "postback",
          label: rd.optionB.label || "選擇 B",
          data: `action=goto&storyId=${storyId}&nodeId=${rd.optionB.targetNodeId}`,
          displayText: rd.optionB.label || "選擇 B",
        });
      }
    } else if (isLast && p.pageType === "next") {
      const rd = p.renderData || {};
      let nextNodeId = rd.targetNodeId;
      if (!nextNodeId) {
        const match = nodeId.match(/n(\d+)/);
        if (match) nextNodeId = `n${parseInt(match[1]) + 1}`;
      }

      if (nextNodeId) {
        actions.push({
          type: "postback",
          label: rd.nextLabel || rd.buttonLabel || "繼續",
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
      title: p.pageType === "dialogue" ? p.renderData?.speakerName?.substring(0, 40) : undefined,
      text: (p.renderData?.text || p.renderData?.prompt || "...").substring(0, 60),
      actions: actions.slice(0, 3),
    };
  });

  return client.replyMessage({
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
