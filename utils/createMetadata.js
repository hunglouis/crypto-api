const fs = require('fs');

const path = require('path');

const uploadToPinata =
  require('./uploadToPinata');

async function createMetadata({

  title,
  description,
  previewURL,
  thumbnailURL,
  fullAudioURL,
  creator

}) {

  const metadata = {

    name: title,

    description,

    image: thumbnailURL,

    animation_url: previewURL,

    external_url: fullAudioURL,

    attributes: [

      {
        trait_type: 'Creator',
        value: creator
      },

      {
        trait_type: 'Type',
        value: 'Music NFT'
      }
    ]
  };

  const metadataPath =
    path.join(
      'metadata',
      `${Date.now()}.json`
    );

  fs.writeFileSync(
    metadataPath,
    JSON.stringify(metadata, null, 2)
  );

  const metadataURL =
    await uploadToPinata(metadataPath);

  return metadataURL;
}

module.exports = createMetadata;