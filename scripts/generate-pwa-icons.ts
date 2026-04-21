import sharp from "sharp";
import { mkdirSync } from "fs";

mkdirSync("public/icons", { recursive: true });

// SVG source: indigo rounded square with "M" letter
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#6366f1"/>
  <text x="256" y="340" font-family="Arial,sans-serif" font-size="280" font-weight="bold"
    fill="white" text-anchor="middle">M</text>
</svg>`;

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

async function generate() {
  for (const { name, size } of sizes) {
    try {
      await sharp(Buffer.from(svg))
        .resize(size, size)
        .png()
        .toFile(`public/icons/${name}`);
      console.log(`Generated public/icons/${name}`);
    } catch (err) {
      // Fallback: create a simple solid color PNG if SVG processing fails (needs librsvg)
      console.log(`SVG processing failed for ${name}, using solid color fallback...`);
      await sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 99, g: 102, b: 241, alpha: 1 }, // indigo-500
        },
      })
        .png()
        .toFile(`public/icons/${name}`);
      console.log(`Generated public/icons/${name} (solid color fallback)`);
    }
  }
}

generate().catch(console.error);
