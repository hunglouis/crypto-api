const fs = require('fs');

const {
  createPreview
} = require('./createPreview');

const {
  createThumbnail
} = require('./createThumbnail');

const {
  uploadToPinata
} = require('./uploadToPinata');

async function processMusicNFT({

  audioFile,
  coverFile,
  body

}) {

  console.log('Đang tạo preview...');

  const previewPath =
    await createPreview(audioFile.path);

  console.log('Đang tạo thumbnail...');

  const thumbPath =
    await createThumbnail(coverFile.path);

  console.log('Đang upload full audio...');

  const fullAudioURL =
    await uploadToPinata(audioFile.path);

  console.log('Đang upload preview...');

  const previewURL =
    await uploadToPinata(previewPath);

  console.log('Đang upload thumbnail...');

  const thumbURL =
    await uploadToPinata(thumbPath);

  return {

    success: true,

    fullAudioURL,

    previewURL,

    thumbURL
  };
}

module.exports = {
  processMusicNFT
};