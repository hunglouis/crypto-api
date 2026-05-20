const express = require('express');
const cors = require('cors');
const PORT =
  process.env.PORT || 3002;

const app = express();

app.use(cors({
  origin: '*'
}));

const ratesRoute =
  require('./routes/rates');

app.use('/api/rates', ratesRoute);


server.listen(PORT, () => {

  console.log(
    `Server running on ${PORT}`
  );

});