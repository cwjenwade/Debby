import { messagingApi } from "@line/bot-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const blobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

export default async function handler(req, res) {
  const { secret } = req.query;
  if (secret !== process.env.ADMIN_API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // 1. Create Rich Menu
    const richMenu = {
      size: { width: 2500, height: 843 },
      selected: true,
      name: "Debby Rich Menu",
      chatBarText: "選單",
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

    // 2. Upload Image
    const imagePath = path.join(__dirname, "../Marco/assets/richmenu.png");
    if (fs.existsSync(imagePath)) {
      const buffer = fs.readFileSync(imagePath);
      const blob = new Blob([buffer], { type: "image/png" });
      await blobClient.uploadRichMenuImage(richMenuId, blob);
    } else {
      console.warn("Rich menu image not found at", imagePath);
    }

    // 3. Set as Default
    await client.setDefaultRichMenu(richMenuId);

    return res.status(200).json({ ok: true, richMenuId });
  } catch (err) {
    console.error("Setup rich menu failed:", err);
    return res.status(500).json({ error: err.message });
  }
}
