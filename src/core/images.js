// Shrinks images in the browser before they are encrypted and stored.
export const FULL_SIZE = 1600;
export const THUMB_SIZE = 480;
export const PHOTO_SIZE = 320;

async function loadBitmap(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // Older browsers: decode through an <img> element.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

async function encode(canvas) {
  // WebP is smaller; fall back to JPEG where the browser cannot write WebP.
  const webp = await canvasToBlob(canvas, 'image/webp', 0.82);
  if (webp && webp.type === 'image/webp') return webp;
  return canvasToBlob(canvas, 'image/jpeg', 0.85);
}

async function draw(source, width, height, crop) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (crop) ctx.drawImage(source, crop.x, crop.y, crop.size, crop.size, 0, 0, width, height);
  else ctx.drawImage(source, 0, 0, width, height);
  const blob = await encode(canvas);
  return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type, width, height };
}

function fit(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return [Math.round(width * scale), Math.round(height * scale)];
}

// Returns a large version for viewing and a small one for the feed.
export async function prepareStoryImage(file) {
  const bitmap = await loadBitmap(file);
  const [fw, fh] = fit(bitmap.width, bitmap.height, FULL_SIZE);
  const [tw, th] = fit(bitmap.width, bitmap.height, THUMB_SIZE);
  const full = await draw(bitmap, fw, fh);
  const thumb = await draw(bitmap, tw, th);
  bitmap.close?.();
  return { full, thumb };
}

// Square crop from the center, for person photos.
export async function preparePhoto(file) {
  const bitmap = await loadBitmap(file);
  const size = Math.min(bitmap.width, bitmap.height);
  const crop = { x: (bitmap.width - size) / 2, y: (bitmap.height - size) / 2, size };
  const side = Math.min(PHOTO_SIZE, size);
  const photo = await draw(bitmap, side, side, crop);
  bitmap.close?.();
  return photo;
}
