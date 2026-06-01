require('dotenv').config(); // Đảm bảo dòng này luôn nằm trên cùng
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cors = require('cors');
const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const MP3Cutter = require('mp3-cutter');
const { ethers } = require('ethers'); // Giải mã chữ ký Web3

const app = express();
const uploadRoute = require('./routes/upload');
const streamRoute = require('./routes/stream');

// Nhập hàm uploadToPinata an toàn
const uploadToPinataModule = require('./utils/uploadToPinata');
const uploadToPinata = typeof uploadToPinataModule === 'function' ? uploadToPinataModule : uploadToPinataModule.uploadToPinata;

// ==========================================
// 1. CẤU HÌNH MỞ KHÓA CORS CHUẨN
// ==========================================
app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. CẤU HÌNH CÁC ĐƯỜNG DẪN API (ROUTES)
// ==========================================
app.use('/api/upload', uploadRoute);
app.use('/api/stream', streamRoute);

app.get('/', (req, res) => {
  res.send('Crypto & Music API Worker Is Running...');
});

// 🔥 ĐÃ PHỤC HỒI: API trả tỉ giá trực tiếp thời gian thực lấy từ database Supabase
app.get("/api/eth-price", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crypto_rates')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) {
      // Nếu db trống hoặc lỗi, tự trả giá backup để frontend không bị sập trắng
      return res.json({ price: 3150, eth_price: 3150, vnd_rate: 25400, updated_at: new Date().toISOString() });
    }

    // Trả về cấu trúc chứa cả price, eth_price và vnd_rate cho frontend map biến nào cũng trúng
    res.json({
      price: data.eth_price,
      eth_price: data.eth_price,
      vnd_rate: data.vnd_rate,
      updated_at: data.updated_at
    });
  } catch (err) {
    res.status(500).json({ error: "Lỗi kết nối database lấy tỉ giá ngầm" });
  }
});

// Thêm cổng đón nhận lệnh cắt nhạc ngay lập tức từ Server chính
app.post('/api/trigger-cut', async (req, res) => {
  const { trackId } = req.body;

  if (!trackId) {
    return res.status(400).json({ success: false, message: "Thiếu trackId rồi bạn ơi!" });
  }

  console.log(`⚡ [Nhận Lệnh] Server chính vừa báo có bài mới! ID: [${trackId}]. Tiến hành cắt nhạc ngay...`);
  res.status(200).json({ success: true, message: "Đã nhận lệnh, đang xử lý ngầm đây!" });

  try {
    const { data: row, error } = await supabase
      .from('music_tracks') 
      .select('*')
      .eq('id', trackId)
      .single();

    if (row && !error) {
      await processSingleTrack(row); 
    }
  } catch (err) {
    console.error(`❌ Lỗi khi xử lý cắt nhạc cấp tốc cho ID [${trackId}]:`, err.message);
  }
});

// KÍCH HOẠT API MINT TỰ ĐỘNG
const { router: mintRouter, initSupabaseMintRoute } = require('./routes/mintRoutes');
initSupabaseMintRoute(SUPABASE_URL, SUPABASE_ANON_KEY);
app.use('/api', mintRouter);

// ==========================================
// 3. LOGIC LẤY GIÁ BẰNG AXIOS VÀ ĐẨY LÊN SUPABASE (30 GIÂY/LẦN)
// ==========================================
async function updateRatesToSupabase() {
  try {
    const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT`);
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
        
      console.log(`[Binance] Cập nhật thành công ETH: $${ethPrice}`);
    }
  } catch (error) {
    console.error("❌ Lỗi cập nhật tỷ giá tự động từ Binance:", error.message);
  }
}
// Chạy kích hoạt luôn 1 lần đầu khi bật server và lặp lại cứ mỗi 30 giây
updateRatesToSupabase();
setInterval(updateRatesToSupabase, 30000);

// ==========================================
// 4. LUỒNG TỰ ĐỘNG XỬ LÝ NHẠC VÀ ĐIỀU HƯỚNG FILE RÁC (PDF, PNG...)
// ==========================================
async function getItemsToProcess() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/items?select=id,fullAudioURL,previewURL,thumbURL&fullAudioURL=not.is.null&or=(previewURL.is.null,previewURL.eq.EMPTY,thumbURL.is.null,thumbURL.eq.EMPTY)`;
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

// HÀM BỌC: Xử lý cắt nhạc và upload cho ĐÚNG MỘT bài viết được truyền vào
const processSingleTrack = async (row) => {
  const inputPath = `input_${row.id}.mp3`;
  const outputPath = `output_${row.id}.mp3`;
  const isVideo = row.fullAudioURL?.includes('.mp4') || row.fullAudioURL?.includes('video');

  try {
    // 1. TẢI FILE GỐC (Đã thêm cấu hình chống chặn 403)
    const response = await axios.get(row.fullAudioURL, { 
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });

    const writer = fs.createWriteStream(inputPath);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // 2. TIẾN HÀNH CẮT NHẠC 45 GIÂY
    console.log(`✂️ Đang trích xuất cắt 45s từ file nhạc gốc cho ID [${row.id}]...`);
    try {
      MP3Cutter.cut({ src: inputPath, target: outputPath, start: 0, end: 45 });
    } catch (cutError) {
      if (isVideo) {
        console.warn(`⚠️ Bản MP4 của ID [${row.id}] quá phức tạp. Gán tạm bản full làm preview!`);
        await updateItemData(row.id, row.fullAudioURL);
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        return;
      } else {
        throw cutError;
      }
    }

    // 3. UPLOAD BẢN PREVIEW LÊN PINATA
    console.log(`📤 Đang đẩy bản preview lên Pinata cho ID [${row.id}]...`);
    const newPreviewURL = await uploadToPinata(outputPath);

    // 4. CẬP NHẬT DATABASE SUPABASE LẤP ĐẦY Ô TRỐNG
    await updateItemData(row.id, newPreviewURL);
    console.log(`🎉 THÀNH CÔNG RỰC RỠ: Đã có preview cho ID [${row.id}] -> ${newPreviewURL}`);

  } catch (itemError) {
    console.error(`❌ Lỗi tại bài viết ID [${row.id}]:`, itemError.message);
    if (itemError.message.includes('403') || itemError.message.includes('404')) {
      await updateItemData(row.id, 'Error: Chặn truy cập hoặc hỏng link');
    }
  } finally {
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
  }
};

// ĐÃ VÁ LỖI CẮT CHỮ: Hoàn thiện hàm quét tự động xử lý rác ngầm
const autoProcessMissingPreviews = async () => {
  try {
    const rows = await getItemsToProcess();
    if (!rows || rows.length === 0) return;

    console.log(`🔄 [Quét Định Kỳ] Tìm thấy ${rows.length} file cần xử lý...`);
    for (const row of rows) {
      await processSingleTrack(row);
    }
  } catch (globalError) {
    console.error("❌ Lỗi luồng chạy tự động quét ngầm:", globalError.message);
  }
};

// BẬT SERVER ĐÓN CỔNG
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🚀 Server Backend Web3 Music đang chạy cực mượt tại cổng: ${PORT}`);
});
