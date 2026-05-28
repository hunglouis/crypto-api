require('dotenv').config(); // Đảm bảo dòng này luôn nằm trên cùng
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cors = require('cors');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const MP3Cutter = require('mp3-cutter');

const app = express();
const uploadRoute = require('./routes/upload');
const streamRoute = require('./routes/stream');

// Nhập hàm uploadToPinata an toàn
const uploadToPinataModule = require('./utils/uploadToPinata');
const uploadToPinata = typeof uploadToPinataModule === 'function' ? uploadToPinataModule : uploadToPinataModule.uploadToPinata;

// ==========================================
// 1. CẤU HÌNH MỞ KHÓA CORS CHUẨN
// ==========================================
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  methods: ['GET', 'POST', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'x-user-wallet', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// ==========================================
// 2. CẤU HÌNH CÁC ĐƯỜNG DẪN API (ROUTES)
// ==========================================
app.use('/api/upload', uploadRoute);
app.use('/api/stream', streamRoute);

app.get('/', (req, res) => {
  res.send('Crypto & Music API Worker Is Running...');
});

app.get('/api/eth-price', (req, res) => {
  res.json({ price: 3002 });
});

// KÍCH HOẠT API MINT TỰ ĐỘNG
const { router: mintRouter, initSupabaseMintRoute } = require('./routes/mintRoutes');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

initSupabaseMintRoute(SUPABASE_URL, SUPABASE_ANON_KEY);
app.use('/api', mintRouter);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 3. LOGIC LẤY GIÁ VÀ ĐẨY LÊN SUPABASE (30 GIÂY/LẦN)
// ==========================================
async function updateRatesToSupabase() {
  try {
    const response = await axios.get(`https://binance.com`);
    if (response.data && response.data.price) {
      const ethPrice = parseFloat(response.data.price);
      const tỷ_giá_usd_vnd = 25400;

      await supabase
        .from('crypto_rates')
        .update({
          eth_price: ethPrice,
          vnd_rate: tỷ_giá_usd_vnd,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);
    }
  } catch (error) {
    console.error("❌ Lỗi cập nhật tỷ giá:", error.message);
  }
}
setInterval(updateRatesToSupabase, 30000);

// ==========================================
// 4. LUỒNG TỰ ĐỘNG XỬ LÝ NHẠC VÀ ĐIỀU HƯỚNG FILE RÁC (PDF, PNG...)
// ==========================================

async function getItemsToProcess() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/items?select=id,fullAudioURL,previewURL,thumbURL&fullAudioURL=not.is.null&previewURL=is.null`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY ?? "",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return [];
    return res.json();
  } catch (err) {
    return [];
  }
}

async function updateItemData(id, previewURL, thumbURL = null) {
  try {
    const updateData = { previewURL };
    if (thumbURL) updateData.thumbURL = thumbURL;

    await fetch(`${SUPABASE_URL}/rest/v1/items?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY ?? "",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });
  } catch (err) {
    console.error(`❌ Lỗi cập nhật DB ID ${id}:`, err.message);
  }
}

async function autoProcessMissingPreviews() {
  try {
    const items = await getItemsToProcess();
    
    if (items && items.length > 0) {
      console.log(`🎵 [Render] Phát hiện ${items.length} bài cần tạo preview. Đang tiến hành phân loại file...`);
      
      const tmpDir = path.join(__dirname, 'tmp_processing');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      for (const row of items) {
        try {
          console.log(`⏳ Đang kết nối tải file cho ID [${row.id}]...`);
          
          const response = await axios({ 
            url: row.fullAudioURL, 
            method: 'GET', 
            responseType: 'stream',
            timeout: 20000 
          });

          const contentType = (response.headers['content-type'] || '').toLowerCase();
          console.log(`ℹ️ Định dạng file nhận diện: ${contentType} tại ID [${row.id}]`);

          // ==========================================
          // BỘ LỌC TỰ ĐỘNG SỬA SAI: CHỈ CHẤP NHẬN AUDIO HOẶC VIDEO MP4
          // ==========================================
          const isAudio = contentType.includes('audio');
          const isVideo = contentType.includes('video/mp4') || row.fullAudioURL.endsWith('.mp4');

          // Nếu file tải về KHÔNG PHẢI nhạc hoặc video (Nó là PNG, JPG, PDF, TXT, DOCX...)
          if (!isAudio && !isVideo) {
            console.log(`💡 [Tự Sửa Sai] Phát hiện file ĐIỀN NHẦM (${contentType}) tại ô Nhạc của ID [${row.id}].`);
            console.log(`➡️ Đang tự động gom file này sang làm ảnh bìa (thumbURL)...`);
            
            await updateItemData(
              row.id, 
              'Error: Misplaced file (Not audio/video), moved to thumbnail', 
              row.fullAudioURL // Đẩy link PDF, PNG... này sang làm thumbnail!
            );
            continue; 
          }

          // Xác định đuôi file tạm dựa trên định dạng thực tế
          const ext = isVideo ? '.mp4' : '.mp3';
          const inputPath = path.join(tmpDir, `input_${row.id}${ext}`);
          const outputPath = path.join(tmpDir, `preview_${row.id}.mp3`);

          // Ghi file xuống đĩa tạm
          const writer = fs.createWriteStream(inputPath);
          response.data.pipe(writer);
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });

          // TIẾN HÀNH CẮT NHẠC
          console.log(`✂️ Đang trích xuất cắt 45s từ file nhạc gốc cho ID [${row.id}]...`);
          
          try {
            MP3Cutter.cut({ src: inputPath, target: outputPath, start: 0, end: 45 });
          } catch (cutError) {
            if (isVideo) {
              console.warn(`⚠️ Bản MP4 của ID [${row.id}] quá phức tạp. Gán tạm bản full làm preview để tránh treo!`);
              await updateItemData(row.id, row.fullAudioURL);
              if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
              continue;
            } else {
              throw cutError;
            }
          }

          // UPLOAD BẢN PREVIEW LÊN PINATA
          console.log(`📤 Đang đẩy bản preview lên Pinata cho ID [${row.id}]...`);
          const newPreviewURL = await uploadToPinata(outputPath);

          // CẬP NHẬT DATABASE
          await updateItemData(row.id, newPreviewURL);
          console.log(`🎉 THÀNH CÔNG RỰC RỠ: Đã có preview cho ID [${row.id}] -> ${newPreviewURL}`);

          // Dọn dẹp file tạm
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        } catch (itemError) {
          console.error(`❌ Lỗi tại bài viết ID [${row.id}]:`, itemError.message);
          if (itemError.message.includes('404') || itemError.message.includes('timeout')) {
            await updateItemData(row.id, 'Error: Broken link');
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Lỗi luồng chạy ngầm tổng:", error.message);
  }
}

setInterval(autoProcessMissingPreviews, 30000);

const server = http.createServer(app);
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`✅ Server backend active on port ${PORT}`);
});
