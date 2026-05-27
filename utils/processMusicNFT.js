const uploadToPinata = require('./uploadToPinata');
const createMetadata = require('./createMetadata');
const saveMusicToSupabase = require('./saveMusicToSupabase');

async function processMusicNFT({
  audioFile,
  coverFile,
  body
}) {

  // 1. Upload file âm thanh gốc lên Pinata
  console.log('Đang upload full audio lên Pinata...');
  const fullAudioURL = await uploadToPinata(audioFile.path);

  // 2. Upload thẳng ảnh bìa gốc lên Pinata (Bỏ qua bước nén createThumbnail)
  console.log('Đang upload thumbnail ảnh bìa lên Pinata...');
  const thumbnailURL = await uploadToPinata(coverFile.path);

  // 3. Đặt previewURL bằng null để luồng quét đồng loạt tự xử lý sau
  const previewURL = null; 

  // 4. Tạo file Metadata lưu thông tin NFT
  console.log('Đang tạo metadata...');
  const metadataURL = await createMetadata({
    title: body.title,
    description: body.description,
    previewURL, // Giá trị truyền đi sẽ là null
    thumbnailURL,
    fullAudioURL,
    creator: body.creator
  });

  // 5. Lưu thông tin bản ghi sạch sẽ vào Database Supabase
  console.log('Đang lưu thông tin vào Supabase...');
  await saveMusicToSupabase({
    title: body.title,
    description: body.description,
    previewURL, // Lưu vào database là null để trigger luồng quét đồng loạt
    thumbnailURL,
    fullAudioURL,
    metadataURL,
    creatorWallet: body.creator,
    price: body.price || 0
  });

  return {
    success: true,
    fullAudioURL,
    previewURL, // Trả về null cho client biết file đang đợi xử lý ngầm
    thumbnailURL,
    metadataURL
  };
}

module.exports = processMusicNFT;
