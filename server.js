const axios = require('axios');

// 1) API LẤY GIÁ ETH (SỬA DÙNG BINANCE)
app.get('/api/eth-price', async (req, res) => {
  try {
    // Gọi API công khai của Binance để lấy giá ETH theo cặp USDT
    const response = await axios.get('https://binance.com', {
      params: { symbol: 'ETHUSDT' }
    });

    const priceUsdt = parseFloat(response.data.price);

    // Tạo cấu trúc dữ liệu trả về giống hệt CoinGecko cũ để bạn không phải sửa code phía Client
    const mockCoinGeckoData = {
      ethereum: {
        usd: priceUsdt,
        vnd: priceUsdt * 25400 // Tạm tính tỉ giá quy đổi USD/VND thực tế
      }
    };

    res.json(mockCoinGeckoData);
  } catch (error) {
    console.error('Binance ETH price error:', error.message);
    res.status(500).json({ error: 'Không lấy được giá ETH từ Binance' });
  }
});

// 2) API LẤY TỔNG HỢP RATES (SỬA DÙNG BINANCE)
app.get('/api/rates', async (req, res) => {
  try {
    // Gọi đồng thời giá BTC, ETH và SOL từ Binance
    const [btcRes, ethRes, solRes] = await Promise.all([
      axios.get('https://binance.com?symbol=BTCUSDT'),
      axios.get('https://binance.com?symbol=ETHUSDT'),
      axios.get('https://binance.com?symbol=SOLUSDT')
    ]);

    const btcPrice = parseFloat(btcRes.data.price);
    const ethPrice = parseFloat(ethRes.data.price);
    const solPrice = parseFloat(solRes.data.price);

    const mockCoinGeckoRates = {
      bitcoin: { usd: btcPrice, vnd: btcPrice * 25400 },
      ethereum: { usd: ethPrice, vnd: ethPrice * 25400 },
      solana: { usd: solPrice, vnd: solPrice * 25400 }
    };

    res.json(mockCoinGeckoRates);
  } catch (error) {
    console.error('Binance Rates error:', error.message);
    res.status(500).json({ error: 'Không lấy được tỷ giá tổng hợp từ Binance' });
  }
});
