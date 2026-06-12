/**
 * ocrScan.ts
 *
 * Uses @react-native-ml-kit/text-recognition to extract gift card codes
 * from a photo. Works entirely on-device — no API key needed.
 *
 * Gift card code patterns:
 *  - Apple: XXXX-XXXX-XXXX-XXXX (16 chars with dashes) or XXXXXXXXXXXXXXXX (16 chars)
 *  - Steam: XXXXX-XXXXX-XXXXX (15 chars with dashes)
 *  - Amazon: XXXX-XXXXXX-XXXX (14 chars with dashes)
 *  - Generic: 12-20 alphanumeric characters
 */

import TextRecognition from '@react-native-ml-kit/text-recognition'

/** Known gift card code patterns — most specific first */
const CODE_PATTERNS: RegExp[] = [
  // Apple: XXXX-XXXX-XXXX-XXXX
  /\b[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}\b/gi,
  // Steam: XXXXX-XXXXX-XXXXX
  /\b[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}\b/gi,
  // Amazon: XXXX-XXXXXX-XXXX
  /\b[A-Z0-9]{4}-[A-Z0-9]{6}-[A-Z0-9]{4}\b/gi,
  // Google Play / iTunes: 16+ alphanumeric no spaces
  /\b[A-Z0-9]{16,20}\b/g,
  // Generic dashed code: groups of 4+ chars separated by dashes
  /\b[A-Z0-9]{4,}-[A-Z0-9]{4,}(?:-[A-Z0-9]{4,})+\b/gi,
]

/** Words to ignore — common false positives */
const IGNORE_WORDS = new Set([
  'IPHONE', 'APPLE', 'ITUNES', 'CARDYN', 'GIFT', 'CARD',
  'STORE', 'VALID', 'UNTIL', 'EXPIRES', 'CODE', 'SERIAL',
  'MODEL', 'IMEI', 'https', 'http', 'www',
])

/**
 * Run OCR on a local image URI and extract gift card codes.
 * Returns array of detected codes (deduplicated, uppercased).
 */
export async function extractCodesFromImage(imageUri: string): Promise<string[]> {
  const result = await TextRecognition.recognize(imageUri)
  const allText = result.text || ''

  const found = new Set<string>()

  for (const pattern of CODE_PATTERNS) {
    const matches = allText.matchAll(new RegExp(pattern.source, pattern.flags))
    for (const match of matches) {
      const code = match[0].toUpperCase().trim()
      // Skip if it's a common word or too short
      if (IGNORE_WORDS.has(code)) continue
      if (code.replace(/-/g, '').length < 10) continue
      found.add(code)
    }
  }

  return Array.from(found)
}
