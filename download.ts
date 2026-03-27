import fs from 'fs';
import https from 'https';
import path from 'path';

const fileId = '1EVxFLKS-6_O6Pyo1-9z_sXU-afmF2xJD';
const url = `https://drive.google.com/uc?export=download&id=${fileId}`;

function download(url: string, dest: string) {
  https.get(url, (res) => {
    if (res.statusCode === 302 || res.statusCode === 303) {
      download(res.headers.location!, dest);
    } else {
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Downloaded successfully');
      });
    }
  }).on('error', (err) => {
    console.error('Error downloading:', err.message);
  });
}

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}
download(url, 'public/logo.png');
