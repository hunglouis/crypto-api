const express = require('express');
const router = express.Router();
const axios = require('axios'); // Nhớ chạy 'npm install axios' ở backend nếu chưa cài
const { checkAccessRights } = require('../services/audioService');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

router.get('/secure-audio/:contractAddress/:tokenId', async (req, res) => {
    const { contractAddress, tokenId } = req.params;
    const userWallet = req.headers['x-user-wallet'];

    // 1. Kiểm tra đặc quyền Web3 (Creator hoặc Owner)
    const hasFullAccess = await checkAccessRights(userWallet, contractAddress, tokenId);

    try {
        // 2. Tra cứu trực tiếp bảng 'items' trên Supabase của bạn (theo ảnh bạn vừa gửi)
        // Tìm dòng có contract_address và token_id trùng khớp để lấy link Pinata
        const { data: item, error } = await supabase
            .from('items')
            .select('image_url, metadata_url') // Bạn có thể đổi tên cột chứa link file nhạc nếu có cột riêng
            .eq('contract_address', contractAddress.toLowerCase())
            .eq('token_id', tokenId)
            .single();

        if (error || !item) {
            return res.status(404).send('Không tìm thấy thông tin NFT trên cơ sở dữ liệu.');
        }

        // 3. Xác định Link nguồn dữ liệu từ Pinata IPFS
        let targetIpfsUrl = "";
        
        if (hasFullAccess) {
            // ĐỐI TƯỢNG HỢP LỆ (Creator/Owner): Lấy link file gốc đầy đủ
            targetIpfsUrl = item.image_url; // Hoặc cột lưu file nhạc/video gốc của bạn
            console.log(`💎 Cấp quyền nghe FULL từ IPFS cho ví: ${userWallet}`);
        } else {
            // KHÁCH THƯỜNG: Chỉ cấp link file Preview 30s ngắn
            // (Mẹo thực tế: Bạn có thể tạo thêm một cột 'preview_url' trên Supabase để lưu link file 30s sau khi mint)
            targetIpfsUrl = item.preview_url || item.image_url; 
            console.log(`👤 Cấp quyền nghe PREVIEW từ IPFS cho khách vãng lai.`);
        }

        if (!targetIpfsUrl) return res.status(404).send('NFT chưa được cấu hình file âm nhạc.');

        // 4. CHỐNG TẢI LÉN BẰNG STREAM PROXY ĐỘC QUYỀN
        // Server Node.js đóng vai trò đầu mối: Đứng ra kéo dữ liệu nhị phân từ Pinata về RAM 
        // rồi đẩy thẳng ra loa người dùng. Khách hàng F12 sẽ chỉ thấy link localhost:3002 chứ KHÔNG THẤY LINK PINATA GỐC.
        const response = await axios({
            method: 'get',
            url: targetIpfsUrl,
            responseType: 'stream' // Ép kiểu luồng nhị phân streaming liên tục
        });

        // Tự động nhận diện định dạng Video MP4 hoặc Audio MP3 từ Pinata trả về
        const contentType = response.headers['content-type'] || 'audio/mpeg';

        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        // Đẩy luồng dữ liệu trực tiếp ra Frontend mà không lưu đè lên ổ cứng server
        response.data.pipe(res);

    } catch (error) {
        console.error("❌ Lỗi luồng truyền tải dữ liệu IPFS:", error.message);
        return res.status(500).send('Lỗi kết nối mạng lưới đám mây lưu trữ.');
    }
});

module.exports = router;
