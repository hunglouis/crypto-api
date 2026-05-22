const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

// ==========================================
// 1. CẤU HÌNH THÔNG TIN SUPABASE CỦA BẠN
// (Hãy thay thế bằng URL và KEY chính xác của dự án bạn)
// ==========================================
// Thay vì viết chữ cứng, hãy sửa lại thành gọi process.env như thế này:
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ==========================================
// 2. LOGIC LẤY GIÁ VÀ ĐẨY LÊN SUPABASE
// ==========================================
async function updateRatesToSupabase() {
  try {
    // Gọi API lấy giá ETH/USDT trực tiếp từ hệ thống Binance
    const response = await axios.get('https://binance.com');

    if (response.data && response.data.price) {
      const ethPrice = parseFloat(response.data.price);
      const tỷ_giá_usd_vnd = 25400; // Giá USD/VND hiện tại

      // Cập nhật đè dữ liệu vào hàng có id = 1 trên Supabase
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
        console.log(`✅ [${new Date().toLocaleTimeString()}] Đã đồng bộ lên Supabase thành công: ETH = $${ethPrice}`);
      }
    }
  } catch (error) {
    console.error("❌ Lỗi kết nối hoặc lấy dữ liệu Binance:", error.message);
  }
}

// Thêm đoạn này vào cuối cùng file server.js để đánh lừa Render quét cổng
const http = require('http');
const fakeServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Crypto API Worker Is Running...');
});

// Sử dụng cổng do Render cấp hoặc mặc định là 3002
const PORT = process.env.PORT || 3002
fakeServer.listen(PORT, () => {
  console.log(`Fake web listener active on port ${PORT}`);
});


// ==========================================
// 3. THIẾT LẬP TRÌNH ĐIỀU KHIỂN CHẠY TỰ ĐỘNG
// ==========================================
console.log("🚀 Server đồng bộ tỷ giá ngầm đang khởi động...");

// Chạy kiểm tra tức thì 1 lần đầu tiên ngay khi bật server
updateRatesToSupabase();

// Thiết lập lịch cứ đúng 30 giây (30000ms) tự động lặp lại quy trình ngầm
setInterval(updateRatesToSupabase, 30000);
