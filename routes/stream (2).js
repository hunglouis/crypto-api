const express = require('express');

const router = express.Router();

const axios = require('axios');

router.get('/:id', async (req, res) => {

  try {

    const nftId = req.params.id;

    // TODO:
    // check blockchain ownership

    const audioURL =
      'PINATA_AUDIO_URL';

    const response =
      await axios({

        method: 'GET',

        url: audioURL,

        responseType: 'stream'
      });

    res.setHeader(
      'Content-Type',
      'audio/mpeg'
    );

    response.data.pipe(res);

  } catch (err) {

    console.error(err);

    res.status(500).json({

      error: err.message
    });
  }
});

module.exports = router;