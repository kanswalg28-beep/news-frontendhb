#!/usr/bin/env node
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'assets', 'hero-bg.png');
const outputDir = path.join(__dirname, 'assets');

async function generateResponsiveImages() {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    console.log(`Original: ${metadata.width}x${metadata.height}, ${metadata.format}`);

    // Generate WebP at different widths
    const widths = [400, 800, 1200, 1600];
    
    for (const w of widths) {
      if (w < metadata.width) {
        const outputPath = path.join(outputDir, `hero-bg-${w}w.webp`);
        await image.resize(w).webp({ quality: 80 }).toFile(outputPath);
        const stats = fs.statSync(outputPath);
        console.log(`✅ ${outputPath} (${w}w) - ${(stats.size/1024).toFixed(1)} KB`);
      }
    }

    // Generate AVIF at original width
    const avifPath = path.join(outputDir, 'hero-bg.avif');
    await image.avif({ quality: 50 }).toFile(avifPath);
    const avifStats = fs.statSync(avifPath);
    console.log(`✅ ${avifPath} - ${(avifStats.size/1024).toFixed(1)} KB`);

    // Generate WebP at original width
    const webpPath = path.join(outputDir, 'hero-bg.webp');
    await image.webp({ quality: 80 }).toFile(webpPath);
    const webpStats = fs.statSync(webpPath);
    console.log(`✅ ${webpPath} - ${(webpStats.size/1024).toFixed(1)} KB`);

    console.log('\n🎉 All responsive images generated!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

generateResponsiveImages();