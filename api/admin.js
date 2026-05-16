export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(`
<!DOCTYPE html>
<html>
<head>
    <title>Debby 後台管理</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: -apple-system, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; background: #f4f7f6; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        h1 { color: #2d3436; }
        h2 { border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 0; }
        label { display: block; margin: 10px 0 5px; font-weight: bold; }
        input, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button { background: #00b894; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; }
        button:hover { background: #00a884; }
        .danger { background: #d63031; }
        .danger:hover { background: #c23616; }
        pre { background: #eee; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
        .status { margin-top: 10px; padding: 10px; border-radius: 4px; display: none; }
        .success { background: #dff9fb; color: #009432; display: block; }
        .error { background: #fab1a0; color: #c23616; display: block; }
    </style>
</head>
<body>
    <h1>Debby 後台管理</h1>

    <div class="card">
        <h2>身分驗證</h2>
        <label>Admin Secret</label>
        <input type="password" id="secret" placeholder="輸入 ADMIN_API_SECRET">
        <p style="font-size: 12px; color: #666;">請輸入您在 .env 設定的 ADMIN_API_SECRET</p>
    </div>

    <div class="card">
        <h2>LINE 圖文選單 (Rich Menu)</h2>
        <p>點擊下方按鈕將 Marco 的選單圖片上傳並設為預設選單。</p>
        <button onclick="setupRichMenu()">一鍵設置選單</button>
        <div id="rich-menu-status" class="status"></div>
    </div>

    <div class="card">
        <h2>關鍵字訊息設置 (Keywords)</h2>
        <p>在此編輯 Vercel KV 中的關鍵字，修改後即時生效，不需重新部署。</p>
        <textarea id="keywords-json" rows="15">{
  "開始": { "type": "story", "storyId": "story-mvp", "nodeId": "n1" },
  "重來": { "type": "story", "storyId": "story-mvp", "nodeId": "n1" },
  "你好": { "type": "text", "text": "哈囉！我是 Debby。" }
}</textarea>
        <div style="margin-top: 10px; display: flex; gap: 10px;">
            <button onclick="loadKeywords()">載入目前設定</button>
            <button onclick="saveKeywords()">儲存關鍵字設定</button>
        </div>
        <div id="keywords-status" class="status"></div>
    </div>

    <script>
        async function api(action, method = 'GET', body = null) {
            const secret = document.getElementById('secret').value;
            const url = \`/api/admin-api?secret=\${encodeURIComponent(secret)}&action=\${action}\`;
            const options = { method };
            if (body) {
                options.headers = { 'Content-Type': 'application/json' };
                options.body = JSON.stringify(body);
            }
            const res = await fetch(url, options);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'API 請求失敗');
            return data;
        }

        async function setupRichMenu() {
            const status = document.getElementById('rich-menu-status');
            status.className = 'status';
            try {
                const data = await api('setup-rich-menu', 'POST');
                status.innerText = '設置成功！Rich Menu ID: ' + data.richMenuId;
                status.className = 'status success';
            } catch (err) {
                status.innerText = '錯誤: ' + err.message;
                status.className = 'status error';
            }
        }

        async function loadKeywords() {
            const status = document.getElementById('keywords-status');
            status.className = 'status';
            try {
                const data = await api('get-keywords');
                document.getElementById('keywords-json').value = JSON.stringify(data, null, 2);
                status.innerText = '載入成功！';
                status.className = 'status success';
            } catch (err) {
                status.innerText = '錯誤: ' + err.message;
                status.className = 'status error';
            }
        }

        async function saveKeywords() {
            const status = document.getElementById('keywords-status');
            status.className = 'status';
            try {
                const json = JSON.parse(document.getElementById('keywords-json').value);
                await api('save-keywords', 'POST', json);
                status.innerText = '儲存成功！關鍵字已更新至 Vercel KV。';
                status.className = 'status success';
            } catch (err) {
                status.innerText = '錯誤: ' + err.message;
                status.className = 'status error';
            }
        }
    </script>
</body>
</html>
  `);
}
