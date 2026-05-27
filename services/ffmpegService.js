const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');
const pinataSDK = require('@pinata/sdk');

ffmpeg.setFfmpegPath(ffmpegPath);

// KHỞI TẠO SDK BẰNG DUY NHẤT MÃ JWT SIÊU DÀI
const pinata = new pinataSDK({ pinataJWTKey: 'PINATA_JWT:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJkYmU0YWZlMi04ZTNkLTQzODItYmI4MC03NmEyNjYxZjUwNDciLCJlbWFpbCI6Imh1bmdsb3Vpcy5tYW5oaHVuZ0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwicGluX3BvbGljeSI6eyJyZWdpb25zIjpbeyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJGUkExIn0seyJkZXNpcmVkUmVwbGljYXRpb25Db3VudCI6MSwiaWQiOiJOWUMxIn1dLCJ2ZXJzaW9uIjoxfSwibWZhX2VuYWJsZWQiOmZhbHNlLCJzdGF0dXMiOiJBQ1RJVkUifSwiYXV0aGVudGljYXRpb25UeXBlIjoic2NvcGVkS2V5Iiwic2NvcGVkS2V5S2V5IjoiYmM2MGZmMjQzNzYyMWYxODY3YzgiLCJzY29wZWRLZXlTZWNyZXQiOiJmN2Y0NDc2MTk0ZmI3ZmVhZTRkOGFmYzlkNTIzMGI5NDU3MjZkNWMwNDQ3ODFmOGYzZThiYzA3NTZiMGNmN2YzIiwiZXhwIjoxODA1OTUxMjIyfQ.KoZ-lqftq5bv-GDyjvoyHVvcf5h52K9RKYCIv6pBUGI' });

/**
 * Hàm tự động tải ngầm file từ Link IPFS gốc, cắt 30s bằng bản chạy static và đẩy lên Pinata
 */
/**
 * Hàm tự động tải ngầm file từ URL, cắt 30s và đẩy lên Pinata bằng SDK
 */
async function autoCutFromUrlAndUploadToIpfs(fullIpfsUrl, collectionAddress, tokenId) {
    // Tự động bóc tách đuôi file chuẩn xác (.mp3/.mp4)
    const ext = path.extname(fullIpfsUrl).split('?')[0].toLowerCase() || '.mp3';
    const isVideo = (ext === '.mp4');

    const storageDir = path.join(__dirname, '../storage');
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

    const previewTempPath = path.join(storageDir, `bg_preview_${Date.now()}${ext}`);

    try {
        // Chạy FFmpeg cắt trực tiếp luồng mạng
        await new Promise((resolve, reject) => {
            let command = ffmpeg(fullIpfsUrl).setStartTime(0).setDuration(30);
            if (isVideo) {
                command.videoCodec('copy').audioCodec('copy');
            } else {
                command.audioCodec('copy');
            }
            command.output(previewTempPath).on('end', resolve).on('error', reject).run();
        });

        // Đẩy file 30s lên Pinata bằng SDK chính thức
        const readableStreamForFile = fs.createReadStream(previewTempPath);
        const options = {
            // Đặt tên file trên Pinata sử dụng đúng biến collectionAddress viết thường
            pinataMetadata: { name: `preview_${collectionAddress.toLowerCase()}_${tokenId}${ext}` },
            pinataOptions: { cidVersion: 0 }
        };

        const result = await pinata.pinFileToIPFS(readableStreamForFile, options);

        // Xóa ngay file tạm
        if (fs.existsSync(previewTempPath)) fs.unlinkSync(previewTempPath);

        return `https://pinata.cloud{result.IpfsHash}`;

    } catch (error) {
        if (fs.existsSync(previewTempPath)) fs.unlinkSync(previewTempPath);
        console.error("❌ Lỗi xử lý FFmpeg chạy ngầm:", error.message);
        return null;
    }
}


module.exports = { autoCutFromUrlAndUploadToIpfs };
