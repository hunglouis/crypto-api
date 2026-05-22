const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config(); // Hỗ trợ đọc file cấu hình .env nếu có

// ==========================================
// 1. CẤU HÌNH THÔNG TIN SUPABASE CỦA BẠN
// (Hãy thay thế bằng URL và KEY chính xác của dự án bạn)
// ==========================================
const SUPABASE_URL = "https://hmvvjjiiaelcsfqgxbxv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtdnZqamlpYWVsY3NmcWd4Ynh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDg4MzcsImV4cCI6MjA4OTkyNDgzN30.zCpflfgSmBwpwe62P7cr1Ppf5dMUMjh782EhZeZ-kuw";

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

// ==========================================
// 3. THIẾT LẬP TRÌNH ĐIỀU KHIỂN CHẠY TỰ ĐỘNG
// ==========================================
console.log("🚀 Server đồng bộ tỷ giá ngầm đang khởi động...");

// Chạy kiểm tra tức thì 1 lần đầu tiên ngay khi bật server
updateRatesToSupabase();

// Thiết lập lịch cứ đúng 30 giây (30000ms) tự động lặp lại quy trình ngầm
setInterval(updateRatesToSupabase, 30000);
