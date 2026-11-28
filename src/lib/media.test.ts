import { describe, expect, it } from 'vitest'
import { isValidGlbHeader, isValidGltfDocument, storageObjectPath } from './media'

function makeGlbHeader(overrides: { version?: number; declaredLength?: number; chunkLength?: number; chunkType?: number } = {}) {
  const bytes = new Uint8Array(24)
  bytes.set([0x67, 0x6c, 0x54, 0x46], 0) // glTF
  const view = new DataView(bytes.buffer)
  view.setUint32(4, overrides.version ?? 2, true)
  view.setUint32(8, overrides.declaredLength ?? 24, true)
  view.setUint32(12, overrides.chunkLength ?? 4, true)
  view.setUint32(16, overrides.chunkType ?? 0x4e4f534a, true) // JSON
  bytes.set([0x7b, 0x7d, 0x20, 0x20], 20) // "{}  "
  return bytes
}

describe('glTF validation helpers', () => {
  it('accepts a glTF 2.0 document with its required asset metadata', () => {
    expect(isValidGltfDocument({ asset: { version: '2.0' } })).toBe(true)
  })

  it('rejects arbitrary JSON, arrays, null and unsupported glTF versions', () => {
    expect(isValidGltfDocument({ hello: 'world' })).toBe(false)
    expect(isValidGltfDocument([])).toBe(false)
    expect(isValidGltfDocument(null)).toBe(false)
    expect(isValidGltfDocument({ asset: { version: '1.0' } })).toBe(false)
  })

  it('accepts a complete GLB 2.0 header with a JSON first chunk', () => {
    expect(isValidGlbHeader(makeGlbHeader(), 24)).toBe(true)
  })

  it('rejects truncated, wrong-version, wrong-length and non-JSON GLB headers', () => {
    expect(isValidGlbHeader(new Uint8Array(19), 19)).toBe(false)
    expect(isValidGlbHeader(makeGlbHeader({ version: 1 }), 24)).toBe(false)
    expect(isValidGlbHeader(makeGlbHeader({ declaredLength: 25 }), 24)).toBe(false)
    expect(isValidGlbHeader(makeGlbHeader({ chunkType: 0x004e4942 }), 24)).toBe(false)
  })
})

describe('storageObjectPath', () => {
  it('extracts and decodes an object path from the requested bucket', () => {
    expect(storageObjectPath('https://example.supabase.co/storage/v1/object/public/product-images/item%20one/photo.webp', 'product-images'))
      .toBe('item one/photo.webp')
  })

  it('does not return a path from a different bucket', () => {
    expect(storageObjectPath('https://example.supabase.co/storage/v1/object/public/product-models/item/model.glb', 'product-images'))
      .toBeNull()
  })

  it('returns null for malformed URLs or URLs without the bucket marker', () => {
    expect(storageObjectPath('not a URL', 'product-images')).toBeNull()
    expect(storageObjectPath('https://example.com/photo.webp', 'product-images')).toBeNull()
  })
})
