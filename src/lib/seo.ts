export type PageSeo = {
  title: string
  description?: string | null
  keywords?: string[] | null
  canonicalUrl?: string | null
  imageUrl?: string | null
  type?: 'website' | 'product'
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.content = content
}

function setOptionalMeta(attribute: 'name' | 'property', key: string, content?: string | null) {
  const value = content?.trim()
  if (value) {
    upsertMeta(attribute, key, value)
    return
  }
  document.head.querySelector(`meta[${attribute}="${key}"]`)?.remove()
}

export function setPageSeo(seo: PageSeo) {
  document.title = seo.title
  setOptionalMeta('name', 'description', seo.description)
  setOptionalMeta('name', 'keywords', seo.keywords?.length ? seo.keywords.join(', ') : null)
  upsertMeta('property', 'og:type', seo.type === 'product' ? 'product' : 'website')
  upsertMeta('property', 'og:title', seo.title)
  setOptionalMeta('property', 'og:description', seo.description)
  setOptionalMeta('property', 'og:image', seo.imageUrl)
  upsertMeta('name', 'twitter:card', seo.imageUrl ? 'summary_large_image' : 'summary')
  upsertMeta('name', 'twitter:title', seo.title)
  setOptionalMeta('name', 'twitter:description', seo.description)
  setOptionalMeta('name', 'twitter:image', seo.imageUrl)

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (seo.canonicalUrl) {
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.appendChild(canonical)
    }
    canonical.href = seo.canonicalUrl
  } else if (canonical) {
    canonical.remove()
  }
}
