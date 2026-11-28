import { useEffect, useState } from 'react'
import { useAdminConfirm } from '@/components/admin/AdminConfirmProvider'
import { Plus, Trash2, Pencil, Tag, X, Loader2 } from 'lucide-react'
import { supabase, type Category } from '@/lib/supabase'
import { slugify } from '@/lib/format'
import posthog, { isPostHogEnabled } from '@/lib/posthog'

export default function AdminCategories() {
  const confirmAction = useAdminConfirm()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [slug, setSlug] = useState('')
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDescription, setSeoDescription] = useState('')
  const [seoKeywords, setSeoKeywords] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: queryError } = await supabase.from('categories').select('*').order('sort_order')
      if (queryError) {
        setError('Impossible de charger les catégories. Vérifiez la connexion puis réessayez.')
        return
      }
      setCategories((data as Category[]) ?? [])
    } catch {
      setError('Connexion interrompue pendant le chargement des catégories.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setSlug('')
    setSeoTitle('')
    setSeoDescription('')
    setSeoKeywords('')
    setEditingId(null)
    setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Le nom de la catégorie est obligatoire.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const categorySlug = slugify(slug.trim() || name)
      const seoPayload = {
        seo_title: seoTitle.trim() || null,
        seo_description: seoDescription.trim() || null,
        seo_keywords: seoKeywords.split(',').map((keyword) => keyword.trim()).filter(Boolean),
      }
      const { error: seoColumnError } = await supabase
        .from('categories')
        .select('seo_title,seo_description,seo_keywords')
        .limit(1)

      const missingSeoColumns = Boolean(
        seoColumnError &&
        (seoColumnError.code === '42703' ||
          seoColumnError.code === 'PGRST204' ||
          /column .*seo_|schema cache/i.test(seoColumnError.message))
      )
      if (seoColumnError && !missingSeoColumns) {
        setError('Impossible de vérifier les champs SEO. Aucune modification n’a été enregistrée.')
        return
      }

      const basePayload = { name: name.trim(), slug: categorySlug, description: description.trim() || null }
      const savePayload = missingSeoColumns ? basePayload : { ...basePayload, ...seoPayload }
      const result = editingId
        ? await supabase.from('categories').update(savePayload).eq('id', editingId)
        : await supabase.from('categories').insert({ ...savePayload, sort_order: categories.length })

      if (result.error) {
        setError(
          result.error.code === '23505'
            ? 'Ce nom ou ce slug existe déjà. Choisissez une autre valeur.'
            : "Impossible d'enregistrer cette catégorie. Vérifiez les informations puis réessayez."
        )
        return
      }

      if (isPostHogEnabled) {
        posthog.capture(editingId ? 'category_updated' : 'category_created', editingId ? { category_id: editingId } : undefined)
      }
      if (missingSeoColumns && (seoTitle.trim() || seoDescription.trim() || seoKeywords.trim())) {
        setNotice('Catégorie enregistrée. Les champs SEO avancés seront disponibles après application de la migration correspondante.')
      } else {
        setNotice('Catégorie enregistrée.')
      }
      resetForm()
      await loadCategories()
    } catch {
      setError("Connexion interrompue. Vérifiez si la catégorie a été enregistrée avant de réessayer.")
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (cat: Category) => {
    setEditingId(cat.id)
    setName(cat.name)
    setDescription(cat.description ?? '')
    setSlug(cat.slug)
    setSeoTitle(cat.seo_title ?? '')
    setSeoDescription(cat.seo_description ?? '')
    setSeoKeywords((cat.seo_keywords ?? []).join(', '))
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!(await confirmAction({ title: 'Supprimer cette catégorie ?', description: 'Cette catégorie sera supprimée. Vérifiez les produits qui lui sont associés avant de continuer.', confirmLabel: 'Supprimer la catégorie', tone: 'danger' }))) return
    try {
      const { error: deleteError } = await supabase.from('categories').delete().eq('id', id)
      if (deleteError) {
        setError('Impossible de supprimer cette catégorie. Vérifiez si des produits y sont encore associés.')
        return
      }
      if (isPostHogEnabled) posthog.capture('category_deleted', { category_id: id })
      await loadCategories()
    } catch {
      setError('Connexion interrompue. Vérifiez si la catégorie a été supprimée avant de réessayer.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-brand-red" />
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-offwhite">Catégories</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="h-4 w-4" />
          {showForm ? 'Annuler' : 'Ajouter une catégorie'}
        </button>
      </div>

      {error && <div role="alert" className="admin-feedback admin-feedback-error mb-4">{error}</div>}
      {notice && <div role="status" className="admin-feedback mb-4">{notice}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 admin-card animate-slide-up">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-text">Nom *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="Ex: Décorations"
                autoFocus
              />
            </div>
            <div>
              <label className="label-text">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field"
                placeholder="Description courte"
              />
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="label-text">Slug URL</span><input value={slug} onChange={(e) => setSlug(e.target.value)} className="input-field" placeholder="genere-depuis-du-nom" /></label>
            <label className="block"><span className="label-text">Titre SEO</span><input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="input-field" maxLength={70} /></label>
            <label className="block sm:col-span-2"><span className="label-text">Description SEO</span><textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} className="input-field resize-none" rows={2} maxLength={180} /></label>
            <label className="block sm:col-span-2"><span className="label-text">Mots-clés SEO (virgules)</span><input value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} className="input-field" /></label>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
            </button>
            <button type="button" onClick={resetForm} className="btn-ghost">
              <X className="h-4 w-4" />
              Annuler
            </button>
          </div>
        </form>
      )}

      {categories.length === 0 ? (
        <div className="admin-card text-center py-16">
          <Tag className="mx-auto mb-4 h-12 w-12 text-charcoal-500" />
          <p className="text-charcoal-400">Aucune catégorie pour le moment.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <div key={cat.id} className="admin-card group">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-offwhite">{cat.name}</h3>
                  <p className="mt-1 text-xs text-charcoal-400">{cat.description ?? 'Aucune description'}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => handleEdit(cat)} className="btn-ghost text-xs">
                  <Pencil className="h-3.5 w-3.5" />
                  Modifier
                </button>
                <button onClick={() => handleDelete(cat.id)} className="btn-ghost text-xs hover:text-brand-red">
                  <Trash2 className="h-3.5 w-3.5" />
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
