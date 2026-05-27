const express = require('express');
const router = express.Router();
const { autoCutFromUrlAndUploadToIpfs } = require('../services/ffmpegService');
const { createClient } = require('@supabase/supabase-js');

let supabase;

// Hàm nhận Key từ server.js truyền sang
function initSupabaseMintRoute(url, key) {
    if (!supabase) supabase = createClient(url, key);
}

/**
 * API Chạy Ngầm: Cắt nhạc giới hạn từ Link Gốc
 */
router.post('/process-preview-bg', async (req, res) => {
    try {
        // THỐNG NHẤT: Dùng đúng biến 'collectionAddress' theo ứng dụng cũ của bạn
        const { collectionAddress, tokenId, image_url } = req.body;

        if (!image_url) {
            return res.status(400).json({ success: false, error: "Thiếu đường dẫn file gốc." });
        }

        res.json({ success: true, message: "Đang chạy ngầm khâu cắt nhạc..." });

        console.log(`\n⚡ [Chạy ngầm] Bắt đầu xử lý bản xem thử cho NFT #${tokenId}`);
        console.log(`• Địa chỉ bộ sưu tập: ${collectionAddress}`);

        // Truyền biến collectionAddress vào hàm dịch vụ FFmpeg
        const previewUrl = await autoCutFromUrlAndUploadToIpfs(image_url, collectionAddress, tokenId);

        if (previewUrl) {
            // Tìm dòng dựa vào link file gốc độc bản 'image_url' để đè link 30s vào
            const { error } = await supabase
                .from('items')
                .update({ preview_url: previewUrl })
                .eq('image_url', image_url.trim());

            if (error) {
                console.error("❌ [Chạy ngầm] Supabase lỗi:", error.message);
            } else {
                console.log(`✨ [Chạy ngầm] THÀNH CÔNG! Cột preview_url của NFT #${tokenId} đã có dữ liệu thật.`);
            }
        }

    } catch (error) {
        console.error("❌ [Chạy ngầm] Lỗi hệ thống:", error.message);
    }
});


module.exports = { router, initSupabaseMintRoute };
