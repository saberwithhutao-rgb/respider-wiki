// /api/chat.js - 修复版Vercel中转函数
export default async function handler(req, res) {
  // 设置CORS - 方案一（无凭证）
  const allowedOrigins = ['https://saberwithhutao-rgb.github.io', 'https://respider-wiki.vercel.app'];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  // 注意：移除了下面这行
  // res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, stream = false } = req.body;
    const UPSTREAM_URL = 'http://121.43.104.134:3000/api/chat';

    console.log(`Vercel中转: 转发至阿里云服务器, stream模式: ${stream}`);

    const response = await fetch(UPSTREAM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, stream })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('阿里云服务器错误:', response.status, errorText);
      throw new Error(`Upstream error: ${response.status}`);
    }

    // ========== 关键修复部分 ==========
    if (stream) {
      // 设置流式响应头
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // 手动读取并转发数据块
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 将数据块写入响应
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end(); // 结束响应

    } else {
      // 非流式处理保持不变
      const data = await response.json();
      res.json(data);
    }
    // ========== 修复结束 ==========

  } catch (error) {
    console.error('Vercel中转函数错误:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}