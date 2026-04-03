const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');

async function createIcon(size) {
  const image = new Jimp(size, size, '#111827', (err, image) => {
    if (err) throw err;
  });

  const font = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  const text = "SKR";
  
  // 简单居中 (粗略估计)
  const x = (size - 100) / 2;
  const y = (size - 64) / 2;
  
  image.print(font, x, y, text);
  
  const outputPath = path.join(__dirname, 'public', `android-chrome-${size}x${size}.png`);
  await image.writeAsync(outputPath);
  console.log(`Generated ${outputPath}`);
}

async function main() {
  await createIcon(192);
  await createIcon(512);
  console.log("Icons generation complete.");
}

main().catch(console.error);
