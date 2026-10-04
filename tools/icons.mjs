// Turns one square artwork into every icon the app needs.
//   npm run icons                 -- reads icons/source.png
//   npm run icons path/to/art.png
//
// Two things it does that a plain resize does not, and both matter on iOS:
//  1. IT CROPS THE MARGIN. Generated app-icon artwork usually arrives with the rounded
//     corners already drawn and white space outside them. iOS masks the icon itself, so
//     shipping that gives a rounded icon inset inside a white square with a second, smaller
//     rounded shape inside it. The margin is measured and cut.
//  2. IT FLATTENS. A PNG with transparency is composited onto BLACK by iOS, not onto the
//     home screen. Everything here is written opaque, over the artwork's own corner colour.
import sharp from 'sharp';
import { existsSync } from 'fs';

// THE VERSION GOES IN THE FILENAME, NOT IN A QUERY STRING. iOS ignores an apple-touch-icon
// link whose href carries a `?`, which is exactly what a cache-buster looks like -- so the
// bust that was meant to make a new icon arrive is the thing that made NO icon arrive. A new
// filename is a new URL with no query: it dodges the query bug and the icon cache at once.
// Raise this when the artwork changes, re-run, and point index.html and the manifest at the
// new names. The unversioned copies stay for anything that looks for the conventional path.
const V = 3;   // rollergirl: v2 was the first icon, v3 is his alien-on-skates artwork (r31)

const SRC = process.argv[2] || 'icons/source.png';
if (!existsSync(SRC)) { console.error('no source image at ' + SRC + ' -- pass one, or put it there'); process.exit(1); }

const img = sharp(SRC);
const meta = await img.metadata();
const { data, info } = await img.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, C = info.channels;
const at = (x, y) => (y * W + x) * C;
const blank = (x, y) => { const i = at(x, y); return data[i + 3] < 24 || (data[i] > 242 && data[i + 1] > 242 && data[i + 2] > 242); };

// the margin, read off the middle row and column -- the corners are rounded, so the edges
// are not where the content starts
const my = H >> 1, mx = W >> 1;
let l = 0; while (l < W - 1 && blank(l, my)) l++;
let r = W - 1; while (r > 0 && blank(r, my)) r--;
let t = 0; while (t < H - 1 && blank(mx, t)) t++;
let b = H - 1; while (b > 0 && blank(mx, b)) b--;
const m0 = [l, W - 1 - r, t, H - 1 - b];      // the margins as found, before the inset below
// AND THEN INSET PAST THE ROUNDING. Cropping to the content box still leaves the artwork's
// own rounded corners, and the white outside them: this image rounds at 23.1% of its side
// while iOS masks at about 22.5%, so the art is ROUNDER than the mask and a white sliver
// survives in every corner. Measured, not assumed -- the radius is where the art starts
// along the top row of the box. Pulling in by r*(1 - 1/sqrt2) puts the square's corners
// exactly on that arc; a little more puts them safely inside it.
let rad = l; while (rad < r && blank(rad, Math.min(H - 1, t + 2))) rad++;
rad -= l;
const inset = Math.round(rad * (1 - Math.SQRT1_2) * 1.10);
l += inset; r -= inset; t += inset; b -= inset;
// square it about the centre of what was found, and keep it inside the image
const cx = (l + r) / 2, cy = (t + b) / 2;
let side = Math.min(r - l + 1, b - t + 1);
side = Math.min(side, W, H);
let x0 = Math.round(cx - side / 2), y0 = Math.round(cy - side / 2);
x0 = Math.max(0, Math.min(W - side, x0)); y0 = Math.max(0, Math.min(H - side, y0));
console.log('source ' + W + 'x' + H + ' ' + meta.format + '  margin l' + m0[0] + ' r' + m0[1] + ' t' + m0[2] + ' b' + m0[3]);
console.log('corner radius ' + rad + 'px, inset ' + inset + 'px past it');
console.log('crop   ' + side + 'x' + side + ' at ' + x0 + ',' + y0);

// the corner colour, so the rounded corners flatten onto something from the picture itself
const ci = at(Math.min(W - 1, x0 + 6), Math.min(H - 1, y0 + 6));
const bg = { r: data[ci], g: data[ci + 1], b: data[ci + 2], alpha: 1 };
console.log('corner rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')');

const OUT = [
  ['icons/icon-1024.png', 1024],
  ['icons/icon-512-v' + V + '.png', 512],
  ['icons/icon-192-v' + V + '.png', 192],
  ['icons/apple-touch-icon-v' + V + '.png', 180],       // iPhone home screen
  ['icons/apple-touch-icon-167-v' + V + '.png', 167],   // iPad Pro
  ['icons/apple-touch-icon-152-v' + V + '.png', 152],   // older iPad
  ['icons/icon-512.png', 512],
  ['icons/icon-192.png', 192],
  ['icons/apple-touch-icon.png', 180],
  ['icons/favicon-32-v' + V + '.png', 32],
];
for (const [file, n] of OUT) {
  await sharp(SRC).extract({ left: x0, top: y0, width: side, height: side })
    .resize(n, n, { fit: 'cover' }).flatten(bg).png({ compressionLevel: 9 }).toFile(file);
  console.log('wrote ' + file + '  ' + n + 'x' + n);
}
console.log('\nPoint index.html and manifest.webmanifest at the -v' + V + ' names. NEVER add a\nquery string to an apple-touch-icon href -- iOS drops the link entirely.');
