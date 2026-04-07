import Jimp from 'jimp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcImage = path.join(__dirname, '../assets/icon.png');
const resDir = path.join(__dirname, '../android/app/src/main/res');

const sizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192,
};

async function generate() {
  console.log('[IconGenerator] Loading source image...');
  const image = await Jimp.read(srcImage);

  for (const [density, size] of Object.entries(sizes)) {
    const dir = path.join(resDir, `mipmap-${density}`);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    console.log(`[IconGenerator] Generating ${size}x${size} for ${density}...`);
    const resized = image.clone().resize(size, size);
    
    // Save multiple required targets
    resized.write(path.join(dir, 'ic_launcher.png'));
    resized.write(path.join(dir, 'ic_launcher_round.png'));
    resized.write(path.join(dir, 'ic_launcher_foreground.png'));
  }
  console.log('[IconGenerator] Done! All launcher icons updated.');
}

generate().catch(console.error);
