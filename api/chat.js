// /api/chat.js
export default async function handler(req, res) {
  // 只处理POST请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, stream = false } = req.body;
    const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
    const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

    // 转发请求到智谱AI，注意这里的 stream 参数来自前端
    const upstreamResponse = await fetch(ZHIPU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZHIPU_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: messages,
        stream: stream // 关键：将此参数原样传递给智谱
      })
    });

    if (!upstreamResponse.ok) {
      throw new Error(`Upstream error: ${upstreamResponse.status}`);
    }

    // 关键：如果前端请求流式，则我们以流式方式返回
    if (stream) {
      // 设置正确的响应头，以便前端识别为流
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      // 将智谱AI的流直接管道传输给前端
      upstreamResponse.body.pipeTo(new WritableStream({
        write(chunk) {
          res.write(chunk);
        },
        close() {
          res.end();
        }
      })).catch(error => {
        console.error('Stream pipe error:', error);
        res.end();
      });
    } else {
      // 非流式处理保持不变
      const data = await upstreamResponse.json();
      res.status(200).json(data);
    }

  } catch (error) {
    console.error('Proxy Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}