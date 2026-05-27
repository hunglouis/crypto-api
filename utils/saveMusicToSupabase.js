require('dotenv').config(); // Đảm bảo dòng này nằm trên cùng của file
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
// Dự phòng nếu file .env của bạn đặt tên là SUPABASE_KEY hoặc SUPABASE_ANON_KEY
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY; 
const SUPABASE_SERVICE_ROLE=process.env.SUPABASE_SERVICE_ROLE
// Khởi tạo client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ... CÁC ĐOẠN CODE PHÍA DƯỚI CỦA FILE GIỮ NGUYÊN ...




async function saveMusicToSupabase(data) {

  const {

    title,
    description,
    previewURL,
    thumbnailURL,
    fullAudioURL,
    metadataURL,
    creatorWallet,
    price

  } = data;

  const { error } =
    await supabase
      .from('music_nfts')
      .insert([{

        title,

        description,

        preview_url: previewURL,

        thumbnail_url: thumbnailURL,

        full_audio_url: fullAudioURL,

        metadata_url: metadataURL,

        creator_wallet: creatorWallet,

        price
      }]);

  if (error) {

    console.error(error);

    throw error;
  }

  return true;
}

module.exports =
  saveMusicToSupabase;