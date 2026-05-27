const express = require('express');

const router = express.Router();

const multer = require('multer');

const {
  processMusicNFT
} = require('../utils/processMusicNFT');

const upload = multer({
  dest: 'uploads/'
});

router.post(
  '/',
  upload.fields([
    {
      name: 'audio',
      maxCount: 1
    },
    {
      name: 'cover',
      maxCount: 1
    }
  ]),
  async (req, res) => {

    try {

      console.log('FILES:', req.files);

      // KIỂM TRA FILE AUDIO
      if (
        !req.files ||
        !req.files.audio ||
        !req.files.audio[0]
      ) {

        return res.status(400).json({
          error: 'Thiếu file audio'
        });
      }

      // KIỂM TRA FILE COVER
      if (
        !req.files.cover ||
        !req.files.cover[0]
      ) {

        return res.status(400).json({
          error: 'Thiếu file cover'
        });
      }

      const result =
        await processMusicNFT({

          audioFile:
            req.files.audio[0],

          coverFile:
            req.files.cover[0],

          body:
            req.body
        });

      res.json(result);

    } catch (err) {

      console.error(err);

      res.status(500).json({
        error: err.message
      });
    }
  }
);

module.exports = router;