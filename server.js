require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});
io.on('connection', (socket) => {

  console.log('Client connected');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });

});
// 1) ETH PRICE (SỬA: /api/eth-price)
app.get('/api/eth-price', async (req, res) => {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    const response = await axios.get('https://coingecko.com', {
      params: {
        ids: 'ethereum',
        vs_currencies: 'usd,vnd'
      },
      headers: {
        'x-cg-demo-api-key': apiKey,
        'Accept': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('ETH price error:', error.message);
    res.status(500).json({ error: 'Không lấy được giá ETH' });
  }
});

/// Thêm route /api/rates để giao diện gọi không bị lỗi 404
app.get('/api/rates', async (req, res) => {
  try {
    const apiKey = process.env.COINGECKO_API_KEY;
    const response = await axios.get('https://coingecko.com', {
      params: {
        ids: 'bitcoin,ethereum,solana', // Lấy nhiều đồng một lúc cho đủ dùng
        vs_currencies: 'usd,vnd'
      },
      headers: {
        'x-cg-demo-api-key': apiKey,
        'Accept': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Rates error:', error.message);
    res.status(500).json({ error: 'Không lấy được tỷ giá tổng hợp' });
  }
});


// Đảm bảo server listen đúng PORT
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
