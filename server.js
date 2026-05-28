require('dotenv').config(); // Đảm bảo dòng này luôn nằm trên cùng
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const http = require('http');
const uploadToPinata = require('./utils/uploadToPinata'); // Nhớ đảm bảo đường dẫn trỏ đúng vào file uploadToPinata của bạn
const axios = require('axios'); // Thư viện dùng để tải file nhạc từ IPFS về Render
const fs = require('fs');
const path = require('path');


const app = express();
const uploadRoute = require('./routes/upload');
const streamRoute = require('./routes/stream');

// ==========================================
// 1. CẤU HÌNH MỞ KHÓA CORS CHUẨN
// ==========================================
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'], // Đã bao gồm tất cả các cổng frontend của bạn
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

// Endpoint kiểm tra trạng thái hoạt động
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
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Truyền chìa khóa sang khởi tạo cho Route
initSupabaseMintRoute(SUPABASE_URL, SUPABASE_ANON_KEY);
app.use('/api', mintRouter);

// Khởi tạo Supabase cho server.js dùng
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 3. LOGIC LẤY GIÁ VÀ ĐẨY LÊN SUPABASE (30 GIÂY/LẦN)
// ==========================================
async function updateRatesToSupabase() {
  try {
    const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT`);

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

// Khởi chạy vòng lặp cập nhật tỷ giá ngầm
console.log("🚀 Server đồng bộ tỷ giá ngầm đang khởi động...");
updateRatesToSupabase();
setInterval(updateRatesToSupabase, 30000);

// ==========================================
// 4. LUỒNG TỰ ĐỘNG CẮT NHẠC VÀ CẬP NHẬT PREVIEW TRÊN RENDER
// ==========================================
const MP3Cutter = require('mp3-cutter');


// Hàm lấy danh sách bài hát chưa có preview từ Supabase
async function getItemsToProcess() {
  try {
    const url = `${process.env.SUPABASE_URL}/rest/v1/items?select=id,fullAudioURL,previewURL&fullAudioURL=not.is.null&previewURL=is.null`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY ?? "",
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
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
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/items?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY ?? "",
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ previewURL }),
    });
  } catch (err) {
    console.error(`❌ Lỗi khi cập nhật DB cho ID ${id}:`, err.message);
  }
}

// Vòng lặp chạy ngầm tuần tự tự động tải và cắt nhạc
async function autoProcessMissingPreviews() {
  try {
    const items = await getItemsToProcess();
    
    if (items && items.length > 0) {
      console.log(`🎵 [Render] Phát hiện ${items.length} bài cần tạo preview. Đang tiến hành xử lý...`);
      
      const tmpDir = path.join(__dirname, 'tmp_processing');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      for (const row of items) {
        try {
          console.log(`⏳ Đang xử lý tải file và cắt nhạc cho bài viết ID [${row.id}]...`);
          
          const inputPath = path.join(tmpDir, `input_${row.id}.mp3`);
          const outputPath = path.join(tmpDir, `preview_${row.id}.mp3`);

          // Tải file gốc từ IPFS về Render
          const response = await axios({ url: row.fullAudioURL, method: 'GET', responseType: 'stream' });
          const writer = fs.createWriteStream(inputPath);
          response.data.pipe(writer);
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });

          // Cắt nhạc bằng thư viện thuần JS lấy từ giây 0 đến giây 45 cực nhanh
          MP3Cutter.cut({ src: inputPath, target: outputPath, start: 0, end: 45 });

          // Upload bản cắt preview lên Pinata IPFS
          const newPreviewURL = await uploadToPinata(outputPath);

          // Cập nhật ngược lại vào Database Supabase
          await updatePreviewURL(row.id, newPreviewURL);
          console.log(`🎉 THÀNH CÔNG: Đã tạo preview cho bài viết ID [${row.id}] -> ${newPreviewURL}`);

          // Dọn dẹp dứt điểm file tạm trên ổ đĩa
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        } catch (itemError) {
          console.error(`❌ Lỗi tại bài viết ID [${row.id}]:`, itemError.message);
        }
      }
    }
  } catch (error) {
    console.error("❌ Lỗi luồng chạy ngầm:", error.message);
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
