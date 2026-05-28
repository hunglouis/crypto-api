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
// TỰ ĐỘNG QUÉT VÀ TẠO PREVIEW AUDIO SAU MỖI 30 GIÂY
// ==========================================
async function autoProcessMissingPreviews() {
  try {
    console.log("🔍 [Chạy ngầm] Đang quét các bài hát chưa có file preview trên Supabase...");
    
    // Gọi trực tiếp đến hàm logic xử lý hàng loạt của bạn
    const items = await getItemsToProcess();
    
    if (items && items.length > 0) {
      console.log(`🎵 Phát hiện ${items.length} bài hát mới cần tạo file preview. Đang xử lý...`);
      
      // Kích hoạt luồng xử lý đồng thời (Concurrency) đã viết sẵn ở dưới của bạn
      await mapWithConcurrency(items, CONCURRENCY, async (row) => {
        const fnRes = await fetch(`${SUPABASE_URL}/functions/v1/${EDGE_FUNCTION_NAME}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ fullAudioURL: row.fullAudioURL }),
        });

        const text = await fnRes.text();
        if (!fnRes.ok) return { id: row.id, ok: false };

        let data = JSON.parse(text);
        const previewURL = data?.previewURL;
        
        if (previewURL) {
          await updatePreviewURL(row.id, previewURL);
          console.log(`✅ Đã tạo xong preview cho Item ID: ${row.id}`);
        }
      });
    }
  } catch (error) {
    console.error("❌ Lỗi trong quá trình tự động quét tạo preview:", error.message);
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

app.post("/api/process-audios", async (_req, res) => { // Đã chuyển thành /api/process-audios cho đồng bộ quy chuẩn
  try {
    const items = await getItemsToProcess();
    if (!items.length) return res.json({ ok: true, count: 0 });

    const results = await mapWithConcurrency(items, CONCURRENCY, async (row) => {
      const fnRes = await fetch(`${SUPABASE_URL}/functions/v1/${EDGE_FUNCTION_NAME}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ fullAudioURL: row.fullAudioURL }),
      });

      const text = await fnRes.text();
      if (!fnRes.ok) return { id: row.id, ok: false, status: fnRes.status, error: text };

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return { id: row.id, ok: false, error: `Non-JSON response: ${text}` };
      }

      const previewURL = data?.previewURL;
      if (!previewURL) return { id: row.id, ok: false, error: `Missing previewURL in response` };

      await updatePreviewURL(row.id, previewURL);
      return { id: row.id, ok: true, previewURL };
    });

    const summary = results.reduce(
      (acc, r) => {
        acc[r.ok ? "success" : "fail"]++;
        return acc;
      },
      { success: 0, fail: 0 }
    );

    return res.json({ ok: true, total: items.length, concurrency: CONCURRENCY, summary, results });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

// ==========================================
// 5. KHỞI CHẠY SERVER DUY NHẤT
// ==========================================
const server = http.createServer(app);
const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`✅ Server backend active on port ${PORT}`);
});
