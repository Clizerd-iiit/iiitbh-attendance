const fs = require('fs');
const sharp = require('sharp');

const buffer = fs.readFileSync('iiit_logo.png');

const process = async (size) => {
    await sharp({
        create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 15, g: 23, b: 42, alpha: 1 } // #0f172a
        }
    })
    .composite([
        {
            input: await sharp(buffer).resize({
                width: Math.floor(size * 0.7),
                height: Math.floor(size * 0.7),
                fit: 'inside'
            }).toBuffer(),
            gravity: 'center'
        }
    ])
    .toFile(`public/icon-${size}x${size}.png`);
};

(async () => {
    await process(512);
    await process(192);
    console.log("Icons processed successfully.");
})();
