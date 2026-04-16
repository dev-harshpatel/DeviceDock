/**
 * Crops an image to the given pixel area using the Canvas API and returns a PNG Blob.
 * The output is always PNG so quality is lossless and transparent backgrounds are preserved.
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  outputWidth = 560, // 4× the PDF bounding box (140 × 4) for crisp HiDPI rendering
  outputHeight = 280, // 4× the PDF bounding box (70 × 4)
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Canvas toBlob returned null"));
    }, "image/png");
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = src;
  });
}
