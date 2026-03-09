const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconPath = './assets/logo.png';
const outputDir = './ios/QRRestaurant/Images.xcassets/AppIcon.appiconset';

// iOS icon sizes (width x height)
const iconSizes = [
  { size: 1024, scale: 1, idiom: 'ios-marketing' },
  { size: 180, scale: 3, idiom: 'iphone', name: 'iPhone App Icon' },
  { size: 120, scale: 2, idiom: 'iphone', name: 'iPhone App Icon' },
  { size: 167, scale: 2, idiom: 'ipad', name: 'iPad Pro App Icon' },
  { size: 152, scale: 2, idiom: 'ipad', name: 'iPad App Icon' },
  { size: 80, scale: 2, idiom: 'iphone', name: 'iPhone Spotlight and Settings Icon' },
  { size: 76, scale: 1, idiom: 'ipad', name: 'iPad App Icon' },
  { size: 60, scale: 3, idiom: 'iphone', name: 'iPhone App Icon' },
  { size: 58, scale: 2, idiom: 'ipad', name: 'iPad Spotlight Icon' },
  { size: 40, scale: 2, idiom: 'ipad', name: 'iPad Spotlight Icon' },
  { size: 40, scale: 3, idiom: 'iphone', name: 'iPhone Spotlight and Settings Icon' },
];

async function generateIcons() {
  console.log('Generating iOS icon sizes...');
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const images = [];

  for (const icon of iconSizes) {
    const filename = `App-Icon-${icon.size}x${icon.size}@${icon.scale}x.png`;
    const outputPath = path.join(outputDir, filename);
    const size = icon.size;

    console.log(`Creating ${size}x${size}@${icon.scale}x (${icon.idiom})...`);

    try {
      await sharp(iconPath)
        .resize(size, size, { fit: 'cover', position: 'center' })
        .png()
        .toFile(outputPath);

      images.push({
        filename: filename,
        idiom: icon.idiom,
        size: `${icon.size}x${icon.size}`,
        scale: `${icon.scale}x`,
        platform: 'ios'
      });

      console.log(`✓ Generated ${filename}`);
    } catch (err) {
      console.error(`✗ Failed to generate ${filename}:`, err.message);
    }
  }

  // Update Contents.json
  const contentsPath = path.join(outputDir, 'Contents.json');
  const contents = {
    images: images,
    info: {
      version: 1,
      author: 'expo'
    }
  };

  fs.writeFileSync(contentsPath, JSON.stringify(contents, null, 2));
  console.log('\n✓ Updated Contents.json with all icon sizes');
  console.log(`Total icons generated: ${images.length}`);
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
