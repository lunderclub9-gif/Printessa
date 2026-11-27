import { describe, expect, it } from 'vitest'
import { storageObjectPath } from './media'

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
