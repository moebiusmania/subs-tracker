// QR codes for the share links (transfer.ts). The web app loads this as its
// own bundle (js/qr.ts) when the code is first shown; the TUI draws the
// matrix with half blocks.
import { encode } from "uqr";

// Rows of modules, true for dark ones, without the quiet zone. Throws when
// the text doesn't fit in a QR code
export const qrMatrix = (text: string): boolean[][] =>
  encode(text, { ecc: "L", boostEcc: true, border: 0 }).data;

// An SVG with one path for the dark modules and a 4 module quiet zone. The
// colours are fixed: scanners expect dark modules on a light background,
// whatever the theme
export const qrSvg = (text: string): string => {
  const matrix = qrMatrix(text);
  const quiet = 4;
  const size = matrix.length + quiet * 2;
  const path = matrix.flatMap((row, y) =>
    row.map((dark, x) => dark ? `M${x + quiet} ${y + quiet}h1v1h-1z` : "")
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" aria-hidden="true"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
};
