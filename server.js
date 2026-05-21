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
  res.json({
    ethereum: {
      usd: 3000
    }
  });
  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price',
      { params: { ids: 'ethereum', vs_currencies: 'usd,vnd' } }
    );
    res.json(response.data);
  } catch (error) {
    console.error('ETH price error:', error.message);
    res.status(500).json({ error: 'Không lấy được giá ETH' });
  }
});

// 2) RATES (SỬA: /api/rates/eth)
app.get('/api/rates/eth', async (req, res) => {
  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price',
      { params: { ids: 'ethereum', vs_currencies: 'usd,vnd' } }
    );
    res.json(response.data);
  } catch (error) {
    console.error('Rates ETH error:', error.message);
    res.status(500).json({ error: 'Không lấy được dữ liệu' });
  }
});

// Đảm bảo server listen đúng PORT
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
