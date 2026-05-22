require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const { Server } = require('ws'); // Khai báo thư viện WebSocket
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 3005 });
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

// 2) API LẤY TỔNG HỢP RATES (HTTP) - ĐÃ SỬA LINK API BINANCE CHUẨN
app.get('/api/rates', async (req, res) => {
  try {
    const [btcRes, ethRes, solRes] = await Promise.all([
      axios.get('https://binance.com'),
      axios.get('https://binance.com'),
      axios.get('https://binance.com')
    ]);

    const btcPrice = parseFloat(btcRes.data.price);
    const ethPrice = parseFloat(ethRes.data.price);
    const solPrice = parseFloat(solRes.data.price);
    const tỷ_giá_usd_vnd = 25400; // Tỷ giá giả lập cố định

    res.json({
      bitcoin: { usd: btcPrice, vnd: btcPrice * tỷ_giá_usd_vnd },
      ethereum: { usd: ethPrice, vnd: ethPrice * tỷ_giá_usd_vnd },
      solana: { usd: solPrice, vnd: solPrice * tỷ_giá_usd_vnd },
      // Trả thêm cấu hình cũ nếu giao diện frontend của bạn gọi trường eth, usdt độc lập
      eth: ethPrice,
      usdt: 1,
      vnd: tỷ_giá_usd_vnd
    });
  } catch (error) {
    console.error("Lỗi Binance API:", error.message);
    res.status(500).json({ error: 'Không lấy được tỷ giá tổng hợp từ Binance' });
  }
});

// --- CẤU HÌNH WEBSOCKET SERVER CHUẨN (KHÔNG BỊ TRÙNG LẶP) ---
const server = http.createServer(app);
const wssserver = new Server({ server }); // Sử dụng luôn cổng của HTTP server (PORT 3002)

wssserver.on('connection', (ws) => {
  console.log('Client đã kết nối WebSocket thành công!');

  // Gửi tin nhắn chào mừng khi client kết nối thành công
  ws.send(JSON.stringify({ status: 'connected', message: 'Kết nối WebSocket backend thành công!' }));

  // Lắng nghe tin nhắn từ client (ví dụ log nhật ký nghe nhạc gửi lên)
  ws.on('message', (message) => {
    console.log('Nhận nhật ký/dữ liệu từ client:', message.toString());
  });

  ws.on('close', () => {
    console.log('Client đã ngắt kết nối WebSocket.');
  });
});

// Chạy server duy nhất trên một cổng PORT (đã gom cả HTTP và WebSocket chung cấu hình)
server.listen(PORT, () => {
  console.log(`Server HTTP và WebSocket đang hoạt động ổn định tại port ${PORT}`);
});

