import { kv } from "@vercel/kv";
import { messagingApi } from "@line/bot-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const clean = (val) => (val || "").replace(/^["']|["']$/g, "").trim();

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: clean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
});

const blobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: clean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
});

function getSecret() {
  return clean(process.env.ADMIN_API_SECRET);
}

export default async function handler(req, res) {
  const { secret, action } = req.query;
  const adminSecret = getSecret();

  if (secret !== adminSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    if (req.method === "GET") {
      if (action === "get-keywords") {
        const kvKeywords = (await kv.get("debby:keywords")) || {};
        return res.status(200).json(kvKeywords);
      }
    }

    if (req.method === "POST") {
      const body = req.body;

      if (action === "save-keywords") {
        await kv.set("debby:keywords", body);
        return res.status(200).json({ ok: true });
      }

      if (action === "setup-rich-menu") {
        const richMenu = {
          size: { width: 2500, height: 843 },
          selected: true,
          name: "Debby Rich Menu",
          chatBarText: "點我開選單",
          areas: [
            {
              bounds: { x: 0, y: 0, width: 833, height: 843 },
              action: { type: "message", text: "開始" },
            },
            {
              bounds: { x: 833, y: 0, width: 833, height: 843 },
              action: { type: "message", text: "下一步" },
            },
            {
              bounds: { x: 1666, y: 0, width: 834, height: 843 },
              action: { type: "message", text: "重來" },
            },
          ],
        };

        const response = await client.createRichMenu({ richMenu });
        const richMenuId = response.richMenuId;

        const imagePath = path.join(__dirname, "../Marco/assets/richmenu.png");
        if (fs.existsSync(imagePath)) {
          const buffer = fs.readFileSync(imagePath);
          const blob = new Blob([buffer], { type: "image/png" });
          await blobClient.uploadRichMenuImage(richMenuId, blob);
        }

        await client.setDefaultRichMenu(richMenuId);
        return res.status(200).json({ ok: true, richMenuId });
      }
    }

    return res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    console.error("Admin API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
