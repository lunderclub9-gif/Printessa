import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Package } from 'lucide-react'
import { supabase, type Category, type Product } from '@/lib/supabase'
import ProductCard from '@/components/ProductCard'
import { setPageSeo } from '@/lib/seo'

export default function CategoryPage() {
  const { slug } = useParams()
  const [category, setCategory] = useState<Category | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setLoadError(null)
      setCategory(null)
      setProducts([])
      try {
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select('*')
          .eq('slug', slug ?? '')
          .eq('is_active', true)
          .maybeSingle()
        if (categoryError) throw categoryError
        if (!categoryData) return

        const current = categoryData as Category
        const { data: productData, error: productsError } = await supabase
          .from('products')
          .select('*, category:categories(*), product_images(*), product_options(id, values:product_option_values(is_active)), product_variants(stock_quantity,made_to_order,is_active)')
          .eq('category_id', current.id)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
        if (productsError) throw productsError
        if (cancelled) return
        setCategory(current)
        setProducts((productData as Product[]) ?? [])
      } catch {
        if (!cancelled) setLoadError('Impossible de charger cette catégorie. Vérifiez votre connexion puis réessayez.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [slug, reloadKey])

  useEffect(() => {
    if (!category) return
    setPageSeo({
      title: category.seo_title?.trim() || `${category.name} | LUNDER'S 3D STUDIO`,
      description: category.seo_description?.trim() || category.description || `Découvrez les produits de la catégorie ${category.name} chez LUNDER'S 3D STUDIO.`,
      keywords: category.seo_keywords ?? [],
      canonicalUrl: `${window.location.origin}/boutique/categories/${encodeURIComponent(category.slug)}`,
      type: 'website',
    })
  }, [category])

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-brand-red" /></div>
  if (loadError) return <div className="mx-auto max-w-7xl px-4 py-24 text-center"><p role="alert" className="mb-4 text-sm text-brand-red-light">{loadError}</p><button type="button" onClick={() => setReloadKey((value) => value + 1)} className="btn-primary">Réessayer</button></div>
  if (!category) return <div className="mx-auto max-w-7xl px-4 py-24 text-center"><Package className="mx-auto mb-4 h-12 w-12 text-charcoal-500" /><h1 className="text-xl font-semibold text-offwhite">Catégorie introuvable</h1><Link to="/boutique/produits" className="btn-primary mt-6"><ArrowLeft className="h-4 w-4" />Retour à la boutique</Link></div>

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link to="/boutique/produits" className="btn-ghost mb-6"><ArrowLeft className="h-4 w-4" />Toutes les catégories</Link>
      <header className="mb-8"><p className="text-xs font-semibold uppercase tracking-widest text-brand-red">Catégorie</p><h1 className="mt-2 text-3xl font-bold text-offwhite">{category.name}</h1>{category.description && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-charcoal-300">{category.description}</p>}</header>
      {products.length === 0 ? <div className="card py-16 text-center"><Package className="mx-auto mb-4 h-12 w-12 text-charcoal-500" /><p className="text-charcoal-400">Aucun produit publié dans cette catégorie.</p></div> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => { const image = product.product_images?.find((item) => item.is_primary)?.image_url ?? product.product_images?.[0]?.image_url; return <ProductCard key={product.id} product={product} imageUrl={image} /> })}</div>}
    </div>
  )
}
