const express = require('express');

const router = express.Router();

router.get('/:id', async (req, res) => {

  res.json({
    success: true,
    message: 'STREAM API OK'
  });

});

module.exports = router;