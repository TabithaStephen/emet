import sharp from "sharp";

/** Checks the generated demo logos really contain what the demo claims. */
const DIR = "/Users/stephenprabu/Desktop/emet/public/demo-assets";

async function analyse(file) {
  const img = sharp(`${DIR}/${file}`);
  const { width, height } = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  const at = (x, y) => { const i = (y * width + x) * ch; return [data[i], data[i+1], data[i+2]]; };
  const near = (p, t, tol = 46) =>
    Math.abs(p[0]-t[0]) < tol && Math.abs(p[1]-t[1]) < tol && Math.abs(p[2]-t[2]) < tol;

  let teal = 0, orange = 0, navy = 0, ink = 0, wordmark = 0, tagline = 0, underline = 0;
  for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
    const p = at(x, y);
    if (near(p, [43,179,163])) teal++;
    if (near(p, [232,118,44])) orange++;
    if (near(p, [16,35,63])) navy++;
    if (p[0] < 235 || p[1] < 235 || p[2] < 235) {
      ink++;
      if (x > 360 && y > 120 && y < 240) wordmark++;
      if (x > 360 && y > 258 && y < 320) tagline++;
      if (x > 372 && x < 888 && y >= 244 && y <= 262) underline++;
    }
  }
  return { file, width, height, teal, orange, navy, ink, wordmark, tagline, underline };
}

const a = await analyse("novatech-approved.png");
const m = await analyse("novatech-modified.png");

console.log("=== colour census (sampled every 2px) ===");
for (const r of [a, m])
  console.log(`  ${r.file.padEnd(24)} ${(r.width+"x"+r.height).padEnd(10)} teal=${String(r.teal).padEnd(6)} orange=${String(r.orange).padEnd(6)} navy=${r.navy}`);

console.log("\n=== did the text actually rasterise? ===");
for (const r of [a, m])
  console.log(`  ${r.file.padEnd(24)} wordmark=${String(r.wordmark).padEnd(6)} tagline=${String(r.tagline).padEnd(6)} underline=${r.underline}`);

const checks = [
  ["approved has teal", a.teal > 500],
  ["approved has no orange", a.orange < 50],
  ["modified has orange", m.orange > 500],
  ["modified has no teal", m.teal < 50],
  ["both have a navy wordmark", a.navy > 500 && m.navy > 500],
  ["approved wordmark rendered", a.wordmark > 2000],
  ["modified wordmark rendered", m.wordmark > 2000],
  ["modified wordmark is bolder", m.wordmark > a.wordmark],
  ["both taglines rendered", a.tagline > 500 && m.tagline > 500],
  ["only modified has the underline", m.underline > 1500 && a.underline < 300],
  ["modified symbol is larger", m.orange > a.teal],
  ["images differ overall", Math.abs(m.ink - a.ink) > 1000],
];
console.log("\n=== assertions ===");
let fail = 0;
for (const [n, p] of checks) { if (!p) fail++; console.log(`  ${p ? "PASS" : "FAIL"}  ${n}`); }
console.log(`\n  ${checks.length - fail}/${checks.length} passed`);
process.exit(fail ? 1 : 0);
