const axios = require('axios');

const fs = require('fs');

const FormData = require('form-data');

async function uploadToPinata(filePath) {

  const data = new FormData();

  data.append(
    'file',
    fs.createReadStream(filePath)
  );

  const res = await axios.post(

    'https://api.pinata.cloud/pinning/pinFileToIPFS',

    data,

    {
      maxBodyLength: Infinity,

      headers: {

        Authorization:
          `Bearer ${process.env.PINATA_JWT}`,

        ...data.getHeaders()
      }
    }
  );

  return `https://gateway.pinata.cloud/ipfs/${res.data.IpfsHash}`;
}

module.exports = {
  uploadToPinata
};