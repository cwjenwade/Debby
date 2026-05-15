const fs = require('fs');
const path = require('path');

let canvas;
try {
  canvas = require('canvas');
} catch (e) {
  console.error('\n❌ 找不到 canvas 模組。');
  process.exit(1);
}

const { createCanvas, loadImage, registerFont } = canvas;

// 如果有字體檔案，可以註冊，否則使用系統預設字體
// registerFont('/System/Library/Fonts/PingFang.ttc', { family: 'PingFang' });

const W = 1080;
const H = 1500;

// 輔助函式：繪製圓角矩形
function drawRoundedRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

// 輔助函式：繪製圓形圖片（頭像）
function drawCircleImage(ctx, color, centerX, centerY, radius, strokeColor, strokeWidth) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true);
  ctx.closePath();
  
  if (strokeColor) {
    ctx.lineWidth = strokeWidth || 10;
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
  }
  
  ctx.clip();
  
  // 用顏色當作假圖片 (未來替換成真實圖片的 ctx.drawImage)
  ctx.fillStyle = color;
  ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
  
  // 加點可愛的特徵（模擬熊的耳朵之類的，為了區分頭像）
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.arc(centerX, centerY + radius / 2, radius / 2, 0, Math.PI * 2, true);
  ctx.fill();
  
  ctx.restore();
}

// 輔助函式：置中自動換行文字
function fillTextWrappedCentered(ctx, text, x, y, maxWidth, lineHeight) {
  if (!text) return;
  const words = text.split(''); // 中文以字為單位切分
  let line = '';
  const lines = [];

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line);
      line = words[n];
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  // 為了垂直置中，先計算總高度
  const totalHeight = lines.length * lineHeight;
  let currentY = y - (totalHeight / 2) + (lineHeight / 2); // 調整至中心點

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l) => {
    ctx.fillText(l, x, currentY);
    currentY += lineHeight;
  });
  ctx.textAlign = 'left'; // reset
  ctx.textBaseline = 'alphabetic'; // reset
}

async function renderCard(page, outputDir) {
  const cvs = createCanvas(W, H);
  const ctx = cvs.getContext('2d');

  // 背景底色：白色 / 暖白
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  const renderData = page.renderData || {};

  // 繪製假圖片區域 (如果該卡片需要圖片)
  const drawMainImage = (height) => {
    // 繪製一個柔和的底色代表圖片區塊
    ctx.fillStyle = '#E8E1D5';
    ctx.fillRect(0, 0, W, height);
    
    // 簡單的裝飾線條代表有圖片
    ctx.strokeStyle = '#D3C9B8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, height);
    ctx.moveTo(W, 0);
    ctx.lineTo(0, height);
    ctx.stroke();
  };

  // 定義共用版型參數
  const IMAGE_HEIGHT = 1000;
  const AVATAR_RADIUS = 130; // 頭像半徑
  const AVATAR_Y = IMAGE_HEIGHT; // 頭像跨越圖片與白底的交界線
  const TEXT_Y_CENTER = IMAGE_HEIGHT + ((H - IMAGE_HEIGHT) / 2); // 白底區域的垂直中心

  switch (page.pageType) {
    case 'dialogue':
      // 1) 圖片
      drawMainImage(1000);
      
      const isHero = renderData.speakerName === '熊熊' || renderData.speakerCharacterId === 'char-hero';
      const isLeft = isHero;
      
      const avatarRadius = 130;
      const avatarY = 1000;
      const avatarX = isLeft ? 240 : W - 240;
      
      const name = renderData.speakerName || '神秘人';
      ctx.font = 'bold 44px sans-serif';
      const nameWidth = ctx.measureText(name).width;
      
      const badgePadding = 40;
      const badgeHeight = 80;
      const overlap = 60; // 被頭像蓋住的長度
      const badgeWidth = nameWidth + badgePadding * 2 + overlap;
      const badgeColor = isLeft ? '#A4745E' : '#CE6A78';
      
      let badgeStartX, textX;
      if (isLeft) {
        badgeStartX = avatarX + avatarRadius - overlap;
        textX = badgeStartX + overlap + (nameWidth + badgePadding * 2) / 2;
      } else {
        badgeStartX = avatarX - avatarRadius + overlap - badgeWidth;
        textX = badgeStartX + (nameWidth + badgePadding * 2) / 2;
      }
      
      // 2) 姓名牌 (Badge)
      drawRoundedRect(ctx, badgeStartX, avatarY - badgeHeight + 20, badgeWidth, badgeHeight, 40, badgeColor);
      
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, textX, avatarY - badgeHeight / 2 + 20);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      // 3) 人物頭像
      const avatarColor = isLeft ? '#8B6554' : '#FFFFFF';
      drawCircleImage(ctx, avatarColor, avatarX, avatarY, avatarRadius, '#FFFFFF', 16);
      
      // 4) 下方對話文字
      ctx.fillStyle = '#333333';
      ctx.font = '52px sans-serif';
      fillTextWrappedCentered(ctx, renderData.text || '（沒有對話內容）', W / 2, 1280, 880, 80);
      break;

    case 'choice':
      // 1) 圖片：800px
      drawMainImage(800);
      
      // 2) 選項提問
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 50px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(renderData.prompt || '請選擇：', W / 2, 950);
      ctx.textAlign = 'left';

      // 3) 選項 A
      drawRoundedRect(ctx, 100, 1050, W - 200, 140, 70, '#D3A37C');
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(renderData.optionA?.label || '選項 A', W / 2, 1120);

      // 4) 選項 B
      drawRoundedRect(ctx, 100, 1240, W - 200, 140, 70, '#FFFFFF', '#D3A37C');
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#D3A37C';
      ctx.stroke();
      ctx.fillStyle = '#D3A37C';
      ctx.fillText(renderData.optionB?.label || '選項 B', W / 2, 1310);
      
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      break;

    case 'narration':
      // 1) 圖片
      drawMainImage(1000);
      
      // 2) 文字訊息
      ctx.fillStyle = '#333333';
      ctx.font = '52px sans-serif';
      // 置中於底部區域 (1000 ~ 1500)
      fillTextWrappedCentered(ctx, renderData.text || '敘事文字...', W / 2, 1250, 880, 80);
      break;

    case 'voiceover':
      // 整張都不需要圖片，純背景
      ctx.fillStyle = '#F4EFE6';
      ctx.fillRect(0, 0, W, H);
      
      ctx.fillStyle = '#333333';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const paragraphs = renderData.paragraphs || ['一段旁白', '二段旁白', '三段旁白'];
      const totalP = Math.min(paragraphs.length, 3);
      const spacing = 180;
      const startY = (H - (totalP - 1) * spacing) / 2;
      
      paragraphs.slice(0, 3).forEach((p, idx) => {
        const text = p.length > 12 ? p.substring(0, 12) + '...' : p;
        ctx.fillText(text, W / 2, startY + (idx * spacing));
      });
      
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      break;

    case 'next':
      // 只要出現下一頁就好了，不用放圖！
      ctx.fillStyle = '#F4EFE6';
      ctx.fillRect(0, 0, W, H);
      
      const btnWidth = 460;
      const btnHeight = 140;
      drawRoundedRect(ctx, (W - btnWidth) / 2, (H - btnHeight) / 2, btnWidth, btnHeight, 70, '#5C748C');
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 52px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(renderData.nextLabel || '下一步', W / 2, H / 2);
      
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      break;
      
    default:
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '60px sans-serif';
      ctx.fillText(`未知的卡片類型: ${page.pageType}`, 100, H/2);
  }

  // 儲存檔案
  const ext = '.png';
  const filename = `${page.storyId}_${page.nodeId}_${page.pageId}${ext}`;
  const outPath = path.join(outputDir, filename);
  
  const buffer = cvs.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  
  return outPath;
}

module.exports = {
  renderCard
};
