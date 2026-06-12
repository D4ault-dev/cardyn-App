/**
 * ocrScan.ts
 *
 * Uses @react-native-ml-kit/text-recognition to extract gift card codes
 * from a photo. Works entirely on-device — no API key needed.
 * This module is only imported in production builds — not in Expo Go.
 */

/** Known gift card code patterns — most specific first */
const CODE_PATTERNS: RegExp[] = [
  /\b[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\b/gi,
  /\b[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}\b/gi,
  /\b[A-Z0-9]{4}-[A-Z0-9]{6}-[A-Z0-9]{4}\b/gi,
  /\b[A-Z0-9]{16,20}\b/g,
  /\b[A-Z0-9]{4,}-[A-Z0-9]{4,}(?:-[A-Z0-9]{4,})+\b/gi,
]

const IGNORE_WORDS = new Set([
  'IPHONE', 'APPLE', 'ITUNES', 'CARDYN', 'GIFT', 'CARD',
  'STORE', 'VALID', 'UNTIL', 'EXPIRES', 'CODE', 'SERIAL',
  'MODEL', 'IMEI', 'https', 'http', 'www',
])

/**
 * Run OCR on a local image URI and extract gift card codes.
 * Returns array of detected codes (deduplicated, uppercased).
 * Returns empty array if ML Kit is not available (Expo Go).
 */
export async function extractCodesFromImage(imageUri: string): Promise<string[]> {
  let TextRecognition: any
  try {
    // Dynamic import — safe in Expo Go (will throw, we catch it)
    TextRecognition = require('@react-native-ml-kit/text-recognition').default
  } catch {
    console.log('[OCR] ML Kit not available in this build')
    return []
  }

  const result = await TextRecognition.recognize(imageUri)
  const allText = result.text || ''

  const found = new Set<string>()
  for (const pattern of CODE_PATTERNS) {
    const matches = allText.matchAll(new RegExp(pattern.source, pattern.flags))
    for (const match of matches) {
      const code = match[0].toUpperCase().trim()
      if (IGNORE_WORDS.has(code)) continue
      if (code.replace(/-/g, '').length < 10) continue
      found.add(code)
    }
  }
  return Array.from(found)
}
