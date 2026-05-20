const axios = require('axios');

async function getCoinGeckoPrice(id) {

  const url =
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;

  const response = await axios.get(url);

  return response.data[id].usd;
}

module.exports = {
  getCoinGeckoPrice
};