const createPreview =
  require('./createPreview');

const createThumbnail =
  require('./createThumbnail');

const uploadToPinata =
  require('./uploadToPinata');

const createMetadata =
  require('./createMetadata');

const saveMusicToSupabase =
  require('./saveMusicToSupabase');

async function processMusicNFT({

  audioFile,
  coverFile,
  body

}) {

  console.log(
    'Đang tạo preview...'
  );

  const previewPath =
    await createPreview(
      audioFile.path
    );

  console.log(
    'Đang tạo thumbnail...'
  );

  const thumbnailPath =
    await createThumbnail(
      coverFile.path
    );

  console.log(
    'Đang upload full audio...'
  );

  const fullAudioURL =
    await uploadToPinata(
      audioFile.path
    );

  console.log(
    'Đang upload preview...'
  );

  const previewURL =
    await uploadToPinata(
      previewPath
    );

  console.log(
    'Đang upload thumbnail...'
  );

  const thumbnailURL =
    await uploadToPinata(
      thumbnailPath
    );

  console.log(
    'Đang tạo metadata...'
  );

  const metadataURL =
    await createMetadata({

      title:
        body.title,

      description:
        body.description,

      previewURL,

      thumbnailURL,

      fullAudioURL,

      creator:
        body.creator
    });

  console.log(
    'Đang lưu Supabase...'
  );

  await saveMusicToSupabase({

    title:
      body.title,

    description:
      body.description,

    previewURL,

    thumbnailURL,

    fullAudioURL,

    metadataURL,

    creatorWallet:
      body.creator,

    price:
      body.price || 0
  });

  return {

    success: true,

    fullAudioURL,

    previewURL,

    thumbnailURL,

    metadataURL
  };
}

module.exports =
  processMusicNFT;