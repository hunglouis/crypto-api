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

// Nhập hàm uploadToPinata an toàn (tự động nhận diện cấu trúc export)
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

// Khởi tạo Supabase cho server.js dùng
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

      const { error } = await supabase
        .from('crypto_rates')
        .update({
          eth_price: ethPrice,
          vnd_rate: tỷ_giá_usd_vnd,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) {
        console.error("❌ Lỗi ghi dữ liệu lên Supabase:", error.message);
      } else {
        console.log(`✅ [${new Date().toLocaleTimeString()}] Đã đồng bộ lên Supabase: ETH = $${ethPrice}`);
      }
    }
  } catch (error) {
    console.error("❌ Lỗi kết nối hoặc lấy dữ liệu Binance:", error.message);
  }
}

console.log("🚀 Server đồng bộ tỷ giá ngầm đang khởi động...");
updateRatesToSupabase();
setInterval(updateRatesToSupabase, 30000);

// ==========================================
// 4. LUỒNG TỰ ĐỘNG CẮT NHẠC VÀ CẬP NHẬT PREVIEW TRÊN RENDER
// ==========================================

// Hàm lấy danh sách bài hát chưa có preview từ Supabase
async function getItemsToProcess() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/items?select=id,fullAudioURL,previewURL&fullAudioURL=not.is.null&previewURL=is.null`;
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
    console.error("❌ Lỗi khi lấy danh sách từ Supabase:", err.message);
    return [];
  }
}

// Hàm cập nhật link preview mới vào Supabase
async function updatePreviewURL(id, previewURL) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/items?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_ANON_KEY ?? "",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ previewURL }),
    });
  } catch (err) {
    console.error(`❌ Lỗi khi cập nhật DB cho ID ${id}:`, err.message);
  }
}

// Vòng lặp chạy ngầm tự động quét dữ liệu
async function autoProcessMissingPreviews() {
  try {
    const items = await getItemsToProcess();
    
    if (items && items.length > 0) {
      console.log(`🎵 [Render] Phát hiện ${items.length} bài cần tạo preview. Đang tiến hành xử lý...`);
      
      const tmpDir = path.join(__dirname, 'tmp_processing');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      for (const row of items) {
        try {
          const inputPath = path.join(tmpDir, `input_${row.id}.mp3`);
          const outputPath = path.join(tmpDir, `preview_${row.id}.mp3`);

          console.log(`⏳ Đang kết nối tải file gốc cho ID [${row.id}]...`);
          
          // Tải file gốc từ IPFS về Render
          const response = await axios({ 
            url: row.fullAudioURL, 
            method: 'GET', 
            responseType: 'stream',
            timeout: 15000 
          });

          // KIỂM TRA ĐỊNH DẠNG FILE TỪ SERVER XEM CÓ PHẢI LÀ ẢNH KHÔNG
          const contentType = response.headers['content-type'];
          if (contentType && contentType.includes('image')) {
            console.error(`❌ BỎ QUA ID [${row.id}]: Phát hiện link chứa FILE ẢNH chứ không phải NHẠC!`);
            // Điền chữ lỗi vào database để lần sau vòng lặp bỏ qua không quét lại bản ghi này nữa
            await updatePreviewURL(row.id, 'Error: Source file is an image');
            continue; // Nhảy sang bài tiếp theo luôn
          }

          // Ghi file nhạc hợp lệ xuống ổ đĩa tạm
          const writer = fs.createWriteStream(inputPath);
          response.data.pipe(writer);
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });

          // Tiến hành cắt nhạc lấy 45 giây đầu
          console.log(`✂️ Đang tiến hành cắt 45s nhạc cho ID [${row.id}]...`);
          MP3Cutter.cut({ src: inputPath, target: outputPath, start: 0, end: 45 });

          // Upload bản cắt preview lên Pinata IPFS
          console.log(`📤 Đang đẩy bản preview lên Pinata cho ID [${row.id}]...`);
          const newPreviewURL = await uploadToPinata(outputPath);

          // Cập nhật ngược lại vào Database Supabase
          await updatePreviewURL(row.id, newPreviewURL);
          console.log(`🎉 THÀNH CÔNG RỰC RỠ: Đã có preview cho ID [${row.id}] -> ${newPreviewURL}`);

          // Dọn dẹp dứt điểm file tạm trên ổ đĩa để giải phóng bộ nhớ
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        } catch (itemError) {
          console.error(`❌ Lỗi tại bài viết ID [${row.id}]:`, itemError.message);
          // Nếu lỗi mạng hoặc link chết hẳn, đánh dấu để không quét lại gây treo vòng lặp
          if (itemError.message.includes('404') || itemError.message.includes('timeout')) {
            await updatePreviewURL(row.id, 'Error: Broken link');
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Lỗi luồng chạy ngầm tổng:", error.message);
  }
}

// Kích hoạt vòng lặp quét tự động chạy ngầm (30 giây chạy kiểm tra một lần)
setInterval(autoProcessMissingPreviews, 30000);

// ==========================================
// 5. KHỞI CHẠY SERVER DUY NHẤT
// ==========================================
const server = http.createServer(app);
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`✅ Server backend active on port ${PORT}`);
});
