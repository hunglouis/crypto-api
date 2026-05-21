const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

app.use(cors());

app.get('/', (req, res) => {

  res.send('Backend alive');

});

app.get('/api/rates', (req, res) => {

  res.json({
    rates: {
      MATIC: 0.74,
      VND: 26000
    }
  });

});

const PORT =
  process.env.PORT || 3002;

app.listen(PORT, () => {

  console.log(
    `Server running on ${PORT}`
  );

});

app.get('/', (req, res) => {

  res.send('Crypto API running');

});

app.get('/api/rates/eth', async (req, res) => {

  try {

    const response = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,vnd'
    );

    res.json(response.data);

  } catch (err) {

    res.status(500).json({
      error: 'Không lấy được giá'
    });

  }

});