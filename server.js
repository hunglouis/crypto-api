const express = require('express');
const cors = require('cors');

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