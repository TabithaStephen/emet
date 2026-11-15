/**
 * Generates the two NovaTech demo logos as PNGs.
 *
 * NovaTech is a FICTIONAL brand invented for this prototype. Both files are
 * sample data — no real company's marks are used.
 *
 * Run with:  node scripts/generate-demo-logos.mjs
 *
 * SVG is written by hand here and rasterised with sharp, which Next.js already
 * bundles, so this adds no dependency. Committing the PNGs means the demo works
 * offline and survives a refresh; this script exists so they can be regenerated
 * or tweaked rather than being opaque binaries.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "demo-assets");

const NAVY = "#10233F";
const TEAL = "#2BB3A3";
const ORANGE = "#E8762C";
const SLATE = "#5A6B82";
const FONTS = "Helvetica Neue, Helvetica, Arial, sans-serif";

const W = 1200;
const H = 420;

/** The orbit-and-star symbol. `squash` and `scale` let the copy distort it. */
function symbol({ colour, cx, cy, r, squash = 1, strokeWidth = 9 }) {
  const starR = r * 0.42;
  // Control points are pulled well inside the chord so the sides go concave
  // and the shape reads as a four-point star rather than a diamond.
  const spike = r * 0.055;
  const star = [
    `M ${cx} ${cy - starR}`,
    `Q ${cx + spike} ${cy - spike} ${cx + starR} ${cy}`,
    `Q ${cx + spike} ${cy + spike} ${cx} ${cy + starR}`,
    `Q ${cx - spike} ${cy + spike} ${cx - starR} ${cy}`,
    `Q ${cx - spike} ${cy - spike} ${cx} ${cy - starR}`,
    "Z",
  ].join(" ");

  return `
    <g>
      <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * squash}"
               fill="none" stroke="${colour}" stroke-width="${strokeWidth}"
               transform="rotate(-22 ${cx} ${cy})" />
      <path d="${star}" fill="${colour}" />
    </g>`;
}

/** IMAGE 1 — the official, approved reference mark. */
function approvedSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>
  ${symbol({ colour: TEAL, cx: 196, cy: 196, r: 104, squash: 0.62, strokeWidth: 9 })}
  <text x="360" y="222" font-family="${FONTS}" font-size="124" font-weight="500"
        fill="${NAVY}" letter-spacing="-1">NovaTech</text>
  <text x="362" y="286" font-family="${FONTS}" font-size="30" font-weight="400"
        fill="${SLATE}" letter-spacing="7.5">TECHNOLOGY THAT MOVES YOU</text>
</svg>`;
}

/**
 * IMAGE 2 — the same mark with four deliberate breaches:
 * teal becomes orange, the orbit is re-proportioned, the wordmark is much
 * bolder and wider, and an unauthorised orange rule sits under the name.
 */
function modifiedSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#FFFFFF"/>
  ${symbol({ colour: ORANGE, cx: 196, cy: 196, r: 128, squash: 0.95, strokeWidth: 17 })}
  <text x="372" y="224" font-family="${FONTS}" font-size="126" font-weight="900"
        fill="${NAVY}" letter-spacing="2.5">NovaTech</text>
  <rect x="372" y="246" width="516" height="13" fill="${ORANGE}"/>
  <text x="374" y="306" font-family="${FONTS}" font-size="30" font-weight="400"
        fill="${SLATE}" letter-spacing="7.5">TECHNOLOGY THAT MOVES YOU</text>
</svg>`;
}

async function render(name, svg) {
  const svgPath = path.join(OUT, `${name}.svg`);
  const pngPath = path.join(OUT, `${name}.png`);
  await writeFile(svgPath, svg, "utf8");
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(pngPath);
  const meta = await sharp(pngPath).metadata();
  console.log(`  ${name}.png  ${meta.width}x${meta.height}  ${meta.channels} channels`);
  return pngPath;
}

console.log("Generating NovaTech demo logos (fictional sample brand)…");
await render("novatech-approved", approvedSvg());
await render("novatech-modified", modifiedSvg());
console.log("Done. Files in public/demo-assets/");
