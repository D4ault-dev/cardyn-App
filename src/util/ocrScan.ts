/**
 * ocrScan.ts
 *
 * Uses @react-native-ml-kit/text-recognition to extract gift card codes
 * from a captured photo. Native builds only (iOS/Android >= 1.2.0).
 *
 * Apple gift card codes are typically 16 characters: XGFKQVD5YC96LJTP
 * May also appear as grouped: XGFK-QVD5-YC96-LJTP
 */

import { Platform } from 'react-native'

/** Gift card code patterns — ordered from most to least specific */
const CODE_PATTERNS: RegExp[] = [
  // Apple: 4 groups of 4 (XXXX-XXXX-XXXX-XXXX)
  /\b[A-Z0-9]{4}[-\s]?[A-Z0-9]{4}[-\s]?[A-Z0-9]{4}[-\s]?[A-Z0-9]{4}\b/gi,
  // 5 groups of 5 or 3 groups of 5
  /\b[A-Z0-9]{5}[-\s]?[A-Z0-9]{5}[-\s]?[A-Z0-9]{5}\b/gi,
  // Long unformatted 16-26 char alphanumeric codes (Apple, Steam, etc)
  /\b[A-HJ-NP-Z2-9]{16,20}\b/g,  // Exclude commonly confused O/0, I/1 chars
  /\b[A-Z0-9]{16,20}\b/g,
  // Any dashed alphanumeric group pattern
  /\b[A-Z0-9]{4,}(?:[-][A-Z0-9]{4,}){2,}\b/gi,
]

// Words to ignore in OCR output
const IGNORE_WORDS = new Set([
  'IPHONE', 'APPLE', 'ITUNES', 'CARDYN', 'GIFT', 'CARD', 'STORE',
  'VALID', 'UNTIL', 'EXPIRES', 'CODE', 'SERIAL', 'MODEL', 'IMEI',
  'HTTPS', 'HTTP', 'WWW', 'STEAM', 'RAZER', 'GOOGLE', 'PLAY', 'XBOX',
  'MICROSOFT', 'REDEEM', 'VISIT', 'SHARE', 'YOUR', 'PLEASE', 'TYPE',
  'NOTE', 'BACK', 'FRONT', 'SCRATCH', 'REVEAL', 'TERMS',
])

/**
 * Extract gift card codes from an image URI using on-device ML Kit OCR.
 * Only works in native builds with @react-native-ml-kit/text-recognition linked.
 * Returns [] silently on web or when ML Kit is unavailable.
 */
export async function extractCodesFromImage(imageUri: string): Promise<string[]> {
  // Web doesn't support native modules
  if (Platform.OS === 'web') return []

  let TextRecognition: any
  try {
    TextRecognition = require('@react-native-ml-kit/text-recognition').default
  } catch {
    return []
  }

  if (!TextRecognition?.recognize) return []

  const result = await TextRecognition.recognize(imageUri)
  const rawText: string = result?.text || ''

  if (!rawText.trim()) return []

  // Also check individual blocks/lines for more reliable extraction
  const allTexts: string[] = [rawText]
  if (result?.blocks) {
    for (const block of result.blocks) {
      if (block.text) allTexts.push(block.text)
      if (block.lines) {
        for (const line of block.lines) {
          if (line.text) allTexts.push(line.text)
          if (line.elements) {
            for (const el of line.elements) {
              if (el.text) allTexts.push(el.text)
            }
          }
        }
      }
    }
  }

  const combined = allTexts.join(' ').toUpperCase()
  // Remove spaces within potential codes (OCR sometimes splits characters)
  const cleaned = combined.replace(/([A-Z0-9]) ([A-Z0-9])/g, '$1$2')

  const found = new Set<string>()

  for (const pattern of CODE_PATTERNS) {
    const regex = new RegExp(pattern.source, 'gi')
    const matches = cleaned.matchAll(regex)
    for (const match of matches) {
      // Normalize: remove spaces, keep dashes
      const code = match[0].toUpperCase().replace(/\s+/g, '').trim()
      const stripped = code.replace(/-/g, '')

      // Skip if too short or is a known non-code word
      if (stripped.length < 12) continue
      if (IGNORE_WORDS.has(stripped)) continue
      if (IGNORE_WORDS.has(code)) continue

      // Skip if it looks like a URL or date
      if (code.includes('/') || code.includes('.')) continue

      found.add(code)
    }
  }

  // Deduplicate: if both "XGFKQVD5YC96LJTP" and "XGFK-QVD5-YC96-LJTP" found, keep formatted
  const results = Array.from(found)
  const deduplicated: string[] = []
  for (const code of results) {
    const stripped = code.replace(/-/g, '')
    const alreadyHave = deduplicated.some(c => c.replace(/-/g, '') === stripped)
    if (!alreadyHave) {
      // Prefer the dashed version if both exist
      const dashed = results.find(c => c !== code && c.replace(/-/g, '') === stripped && c.includes('-'))
      deduplicated.push(dashed || code)
    }
  }

  return deduplicated
}
