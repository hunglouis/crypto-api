require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const { Server } = require('ws'); // Khai báo thư viện WebSocket

const app = express();
const PORT = process.env.PORT || 3002;

// Cấu hình Middleware
app.use(cors());
app.use(express.json());

// 1) API LẤY GIÁ ETH (HTTP)
app.get('/api/eth-price', async (req, res) => {
  try {
    const response = await axios.get('https://binance.com');
    const priceUsdt = parseFloat(response.data.price);
    res.json({
      ethereum: { usd: priceUsdt, vnd: priceUsdt * 25400 }
    });
  } catch (error) {
    res.status(500).json({ error: 'Không lấy được giá ETH từ Binance' });
  }
});

// 2) API LẤY TỔNG HỢP RATES (HTTP)
app.get('/api/rates', async (req, res) => {
  try {
    const [btcRes, ethRes, solRes] = await Promise.all([
      axios.get('https://binance.com'),
      axios.get('https://binance.com'),
      axios.get('https://binance.com')
    ]);
    res.json({
      bitcoin: { usd: parseFloat(btcRes.data.price), vnd: parseFloat(btcRes.data.price) * 25400 },
      ethereum: { usd: parseFloat(ethRes.data.price), vnd: parseFloat(ethRes.data.price) * 25400 },
      solana: { usd: parseFloat(solRes.data.price), vnd: parseFloat(solRes.data.price) * 25400 }
    });
  } catch (error) {
    res.status(500).json({ error: 'Không lấy được tỷ giá tổng hợp' });
  }
});

// --- CẤU HÌNH TRÌNH KHỞI TẠO WEBSOCKET SERVER ---
const server = http.createServer(app);
const wss = new Server({ server });

wss.on('connection', (ws) => {
  console.log('Client đã kết nối WebSocket thành công!');

  // Tự động gửi dữ liệu chào mừng hoặc cập nhật giá ban đầu cho client nếu cần
  ws.send(JSON.stringify({ status: 'connected', message: 'Kết nối WebSocket backend thành công!' }));

  ws.on('close', () => {
    console.log('Client đã ngắt kết nối WebSocket.');
  });
});
// ------------------------------------------------

// Thay vì dùng app.listen, ta dùng server.listen để chạy cả HTTP và WebSocket chung một cổng 3002
server.listen(PORT, () => {
  console.log(`Server HTTP và WebSocket đang hoạt động tại port ${PORT}`);
});
