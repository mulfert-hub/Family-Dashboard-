// Fotos verkleinern (spart Speicher und Datenvolumen) und Vorschaubilder erzeugen.
// createImageBitmap mit imageOrientation dreht Handyfotos richtig herum.
async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
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

function toJpeg(src: ImageBitmap | HTMLImageElement, maxSide: number, quality: number): Promise<Blob> {
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width;
  const h = 'naturalHeight' in src ? src.naturalHeight : src.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // durchsichtige PNGs bekommen weißes Papier
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Bild konnte nicht verarbeitet werden.'))), 'image/jpeg', quality));
}

export async function prepare(file: Blob): Promise<{ blob: Blob; thumb: Blob }> {
  const img = await decode(file);
  const [blob, thumb] = await Promise.all([toJpeg(img, 1800, 0.85), toJpeg(img, 480, 0.8)]);
  if ('close' in img) img.close();
  return { blob, thumb };
}

export async function thumbFrom(blob: Blob): Promise<Blob> {
  const img = await decode(blob);
  const t = await toJpeg(img, 480, 0.8);
  if ('close' in img) img.close();
  return t;
}

export async function dataUrl(blob: Blob, maxSide = 200): Promise<string> {
  const img = await decode(blob);
  const small = await toJpeg(img, maxSide, 0.7);
  if ('close' in img) img.close();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(small);
  });
}
