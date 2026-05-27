const sharp = require('sharp');

const path = require('path');

async function createThumbnail(inputPath) {

  const outputPath = path.join(
    'thumbnails',
    `${Date.now()}_thumb.jpg`
  );

  await sharp(inputPath)

    .resize(400, 400)

    .jpeg({
      quality: 90
    })

    .toFile(outputPath);

  return outputPath;
}

module.exports = {
  createThumbnail
};