const fs = require("fs");
const path = require("path");

const REQUIRED_ENV_VARS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

if (missingEnvVars.length > 0) {
  console.error(
    `Missing required Cloudinary environment variables: ${missingEnvVars.join(", ")}`
  );
  process.exit(1);
}

const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const outputDir = path.join(__dirname, "output");
const renderResultPath = path.join(outputDir, "render-result.json");
const publishResultPath = path.join(outputDir, "publish-result.json");

async function main() {
  if (!fs.existsSync(renderResultPath)) {
    console.error(`render-result.json not found at ${renderResultPath}\nRun: node cli.js <manifest.json> first.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(renderResultPath, "utf8");
  const parsed = JSON.parse(raw);
  const results = Array.isArray(parsed.results) ? parsed.results : [];
  const publishResults = [];

  for (const entry of results) {
    if (entry.status !== "rendered") {
      publishResults.push({
        storyId: entry.storyId,
        nodeId: entry.nodeId,
        pageId: entry.pageId,
        pageType: entry.pageType || null,
        public_id: `${entry.storyId}_${entry.nodeId}_${entry.pageId}`,
        cloudinaryUrl: null,
        status: "skipped",
        error: `source status was: ${entry.status}`,
      });
      continue;
    }

    const public_id = `${entry.storyId}_${entry.nodeId}_${entry.pageId}`;
    const baseRecord = {
      storyId: entry.storyId,
      nodeId: entry.nodeId,
      pageId: entry.pageId,
      pageType: entry.pageType || null,
      public_id,
      cloudinaryUrl: null,
      status: "",
      error: null,
    };

    if (!fs.existsSync(entry.localFile)) {
      publishResults.push({
        ...baseRecord,
        status: "file_missing",
        error: `Missing local file: ${entry.localFile}`,
      });
      continue;
    }

    try {
      const result = await cloudinary.uploader.upload(entry.localFile, {
        public_id,
        overwrite: true,
      });

      publishResults.push({
        ...baseRecord,
        status: "uploaded",
        cloudinaryUrl: result.secure_url,
      });
    } catch (err) {
      publishResults.push({
        ...baseRecord,
        status: "upload_failed",
        error: err && err.message ? err.message : String(err),
      });
    }
  }

  fs.writeFileSync(publishResultPath, JSON.stringify(publishResults, null, 2));
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
