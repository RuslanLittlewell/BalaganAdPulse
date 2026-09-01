/**
 * The side of every avatar the app stores. Small on purpose: avatars are drawn
 * at 32-56 px, so 128 covers a retina screen with room to spare, and every
 * picture now travels inline in JSON where four times the pixels would be four
 * times the payload.
 */
export const AVATAR_PX = 128;

/**
 * Redraws any image the browser can decode as a square PNG of `size` pixels.
 *
 * The server stores one shape — a PNG under a megabyte — so a logo picked from
 * disk goes through the same conversion the generated avatar already used, and
 * the upload endpoint needs no second content type. Cropping is centred, which
 * is what a logo wants far more often than letterboxing.
 */
export async function toSquarePng(file: Blob, size = AVATAR_PX): Promise<Blob> {
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    await image.decode();

    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Не удалось подготовить изображение");
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Не удалось создать PNG"))),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(source);
  }
}
