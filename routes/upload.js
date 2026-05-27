const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { processMusicNFT } = require('../utils/processMusicNFT');

// ==========================================
// TỰ ĐỘNG TẠO THƯ MỤC UPLOADS NẾU CHƯA CÓ TRÊN RENDER
// ==========================================
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình Multer trỏ chính xác vào đường dẫn tuyệt đối vừa tạo
const upload = multer({
  dest: uploadDir
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
      console.log('--- Bắt đầu nhận file từ Client ---');
      console.log('FILES:', req.files);

      // KIỂM TRA FILE AUDIO
      if (!req.files || !req.files.audio || !req.files.audio[0]) {
        return res.status(400).json({
          error: 'Thiếu file audio'
        });
      }

      // KIỂM TRA FILE COVER
      if (!req.files.cover || !req.files.cover[0]) {
        return res.status(400).json({
          error: 'Thiếu file cover'
        });
      }

      // Chuyển tiếp dữ liệu sang hàm xử lý core
      const result = await processMusicNFT({
        audioFile: req.files.audio[0],
        coverFile: req.files.cover[0],
        body: req.body
      });

      res.json(result);

    } catch (err) {
      console.error("❌ Lỗi xảy ra tại luồng upload router:", err);
      res.status(500).json({
        error: err.message
      });
    }
  }
);

module.exports = router;
