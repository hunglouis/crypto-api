require('dotenv').config(); // Đảm bảo dòng này luôn nằm trên cùng
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cors = require('cors');
const express = require('express');
const http = require('http');

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
// ĐOẠN CODE GẮN LOG THEO DÕI TIẾN ĐỘ THỰC TẾ
// ==========================================
async function autoProcessMissingPreviews() {
  try {
    const items = await getItemsToProcess();
    
    if (items && items.length > 0) {
      console.log(`🎵 [Bắt đầu] Phát hiện ${items.length} bài cần xử lý. Đang gửi sang Supabase...`);
      
      await mapWithConcurrency(items, CONCURRENCY, async (row) => {
        console.log(`⏳ Đang gửi Item ID [${row.id}] sang Edge Function... URL Gốc: ${row.fullAudioURL}`);
        
        const fnRes = await fetch(`${SUPABASE_URL}/functions/v1/${EDGE_FUNCTION_NAME}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ ipfsUrl: row.fullAudioURL }),
        });

        const text = await fnRes.text();
        
        // NẾU SUPABASE TRẢ VỀ LỖI - SẼ IN RA NGAY TẠI ĐÂY
        if (!fnRes.ok) {
          console.error(`❌ Item ID [${row.id}] Thất bại tại Supabase. Mã lỗi: ${fnRes.status}, Chi tiết: ${text}`);
          return { id: row.id, ok: false };
        }

        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error(`❌ Item ID [${row.id}] Lỗi không phải cấu trúc JSON. Dữ liệu nhận được: ${text}`);
          return { id: row.id, ok: false };
        }

        const previewURL = data?.previewURL;
        
        if (!previewURL) {
          console.error(`❌ Item ID [${row.id}] Thành công nhưng bị SAI KEY dữ liệu. Cấu trúc nhận được là:`, data);
          return { id: row.id, ok: false };
        }

        // TIẾN HÀNH GHI VÀO DATABASE
        console.log(`💾 Đang ghi đè đường link preview mới vào Database cho ID [${row.id}]...`);
        await updatePreviewURL(row.id, previewURL);
        console.log(`🎉 THÀNH CÔNG HOÀN TOÀN: Đã có preview cho ID [${row.id}]`);
        
      });
    }
  } catch (error) {
    console.error("❌ Lỗi hệ thống chạy ngầm:", error.message);
  }
}


// Kích hoạt vòng lặp quét tự động ngầm (Chạy sau mỗi 30 giây)
setInterval(autoProcessMissingPreviews, 30000);

// ==========================================
// 4. LOGIC XỬ LÝ AUDIO PREVIEW CHẠY NGẦM VÀ API
// ==========================================
const EDGE_FUNCTION_NAME = "audio-preview";
const CONCURRENCY = 10;

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let idx = 0;

  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const currentIndex = idx++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
}

async function getItemsToProcess() {
  const url =
    `${SUPABASE_URL}/rest/v1/items` +
    `?select=id,fullAudioURL,previewURL` +
    `&fullAudioURL=not.is.null&previewURL=is.null`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_ANON_KEY ?? "",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) throw new Error(`Fetch items failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function updatePreviewURL(id, previewURL) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/items?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_ANON_KEY ?? "",
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ previewURL }),
  });

  if (!res.ok) throw new Error(`Update previewURL failed: ${res.status} ${await res.text()}`);
}

const { MP3Cutter } = require('mp3-cutter');
const fs = require('fs');
const path = require('path');
const uploadToPinata = require('./utils/uploadToPinata'); // Sử dụng lại file upload Pinata sẵn có của bạn

async function autoProcessMissingPreviews() {
  try {
    const items = await getItemsToProcess();
    
    if (items && items.length > 0) {
      console.log(`🎵 [Render] Phát hiện ${items.length} bài cần tạo preview. Đang tự xử lý...`);
      
      // Tạo thư mục lưu file tạm trên Render nếu chưa có
      const tmpDir = path.join(__dirname, 'tmp_processing');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      for (const row of items) {
        try {
          console.log(`⏳ Đang tải file gốc về Render xử lý cho ID: ${row.id}...`);
          
          const inputPath = path.join(tmpDir, `input_${row.id}.mp3`);
          const outputPath = path.join(tmpDir, `preview_${row.id}.mp3`);

          // 1. Tải file nhạc gốc từ IPFS về ổ đĩa tạm của Render
          const response = await axios({
            url: row.fullAudioURL,
            method: 'GET',
            responseType: 'stream'
          });
          
          const writer = fs.createWriteStream(inputPath);
          response.data.pipe(writer);
          
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });

          // 2. Cắt nhạc bằng thư viện thuần JS cực kỳ nhanh (Ví dụ lấy từ giây thứ 0 đến giây thứ 45)
          console.log(`✂️ Đang cắt nhạc tự động bài số [${row.id}]...`);
          MP3Cutter.cut({
            src: inputPath,
            target: outputPath,
            start: 0,
            end: 45
          });

          // 3. Đẩy file nhạc đã cắt lên Pinata lấy link preview mới
          console.log(`📤 Đang đẩy file preview đã cắt lên Pinata IPFS...`);
          const newPreviewURL = await uploadToPinata(outputPath);

          // 4. Cập nhật thẳng vào Database Supabase từ Render
          await updatePreviewURL(row.id, newPreviewURL);
          console.log(`🎉 HOÀN THÀNH DỨT ĐIỂM: Đã cập nhật preview cho ID [${row.id}] -> ${newPreviewURL}`);

          // Xóa file tạm để dọn sạch ổ đĩa
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

        } catch (itemError) {
          console.error(`❌ Lỗi xử lý bài hát ID [${row.id}]:`, itemError.message);
        }
      }
    }
  } catch (error) {
    console.error("❌ Lỗi luồng chạy ngầm trên Render:", error.message);
  }
};

// ==========================================
// 5. KHỞI CHẠY SERVER DUY NHẤT
// ==========================================
const server = http.createServer(app);
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`✅ Server backend active on port ${PORT}`);
});
