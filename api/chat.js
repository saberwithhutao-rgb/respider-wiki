// /api/chat.js - 修复预检请求的CORS版本
export default async function handler(req, res) {
  // 1. 定义允许的来源（Domain）
  const allowedOrigins = ['https://saberwithhutao-rgb.github.io', 'https://respider-wiki.vercel.app'];
  const requestOrigin = req.headers.origin;
  const isOriginAllowed = allowedOrigins.includes(requestOrigin);

  // 2. 动态设置CORS响应头（仅对允许的来源）
  if (isOriginAllowed) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
  }
  // 明确设置其他CORS头（预检请求和实际请求都需要）
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // 注意：如果你不需要Cookie，最好移除下面这行，避免复杂化
  // res.setHeader('Access-Control-Allow-Credentials', 'true');

  // 3. 专门处理预检请求 (OPTIONS)
  if (req.method === 'OPTIONS') {
    // 关键：对于OPTIONS请求，返回200即可，无需其他逻辑
    return res.status(200).end();
  }

  // 4. 验证实际请求方法 (POST)
  if (req.method !== 'POST') {
    // 注意：对于非POST的其它请求（如GET），也应返回CORS头
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 5. 主逻辑：转发请求到阿里云
  try {
    const { messages, stream = false } = req.body;
    const UPSTREAM_URL = 'http://121.43.104.134:80/api/chat';

    console.log(`Vercel中转: 转发至阿里云, stream: ${stream}, 来源: ${requestOrigin}`);

    const response = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, stream })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('阿里云服务器错误:', response.status, errorText);
      throw new Error(`上游错误: ${response.status}`);
    }

    // 6. 处理流式与非流式响应
    if (stream) {
      // 对于流式响应，头部已设置，直接管道传输数据块
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();

    } else {
      const data = await response.json();
      res.json(data);
    }

  } catch (error) {
    console.error('Vercel中转函数错误:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}