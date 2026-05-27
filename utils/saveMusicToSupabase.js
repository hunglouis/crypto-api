const { createClient } =
  require('@supabase/supabase-js');

const supabase =
  createClient(

    process.env.SUPABASE_URL,

    process.env.SUPABASE_SERVICE_ROLE
  );

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