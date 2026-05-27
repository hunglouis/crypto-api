
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

async function createPreview(inputPath) {

  // Đặt đoạn này ngay trước lệnh chạy ffmpeg của bạn
  const previewDir = path.join(__dirname, 'previews');
  if (!fs.existsSync(previewDir)) {
    fs.mkdirSync(previewDir, { recursive: true });
  }

  const outputPath = path.join(
    previewDir,
    `${Date.now()}_preview.mp3`
  );

  return new Promise((resolve, reject) => {

    ffmpeg(inputPath)

      .setStartTime(0)

      .duration(45)

      .audioBitrate(128)

      .save(outputPath)

      .on('end', () => {

        resolve(outputPath);

      })

      .on('error', reject);
  });
}

module.exports = {
  createPreview
};