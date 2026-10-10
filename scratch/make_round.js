const Jimp = require('jimp');
const path = require('path');

async function makeRound() {
  try {
    const inputPath = path.join(__dirname, '..', 'public', 'funaab-logo.png');
    const outputPath = path.join(__dirname, '..', 'public', 'favicon-round.png');
    
    console.log('Reading:', inputPath);
    const image = await Jimp.read(inputPath);
    
    // Crop it to a circle
    image.circle();
    
    console.log('Writing to:', outputPath);
    await image.writeAsync(outputPath);
    console.log('Done!');
  } catch (err) {
    console.error(err);
  }
}

makeRound();
