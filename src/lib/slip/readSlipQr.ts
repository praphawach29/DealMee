import sharp from 'sharp'
import jsQR from 'jsqr'
import { slipVerify } from 'promptparse/validate'

export interface SlipQr {
  /** Bank code of the sending bank (e.g. '014' for SCB) */
  sendingBank: string
  /** Transaction reference, the same one the bank and slip-check providers use */
  transRef: string
}

// Wide enough to keep a slip's mini-QR readable, small enough to scan quickly
const MAX_SCAN_WIDTH = 1400

/**
 * Reads the verification mini-QR printed on Thai bank transfer slips, locally and
 * for free. Returns null when the picture has no slip QR (a product photo, a
 * sticker) or the QR can't be read; callers must treat null as "unknown", not as
 * "fake slip", since a blurry or cropped real slip also returns null.
 */
export async function readSlipQr(imageBase64: string): Promise<SlipQr | null> {
  try {
    const { data, info } = await sharp(Buffer.from(imageBase64, 'base64'))
      .rotate()
      .resize({ width: MAX_SCAN_WIDTH, withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const code = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), info.width, info.height)
    if (!code?.data) return null

    // Some bank apps print a QR with a bad checksum; promptparse can repair it
    return slipVerify(code.data, true)
  } catch (err) {
    console.warn('[SlipQr] Could not scan image:', err instanceof Error ? err.message : err)
    return null
  }
}
