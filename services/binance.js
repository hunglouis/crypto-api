const axios = require('axios');

async function getBinancePrice(symbol) {

  const url =
    `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`;

  const response = await axios.get(url);

  return parseFloat(response.data.price);
}

module.exports = {
  getBinancePrice
};