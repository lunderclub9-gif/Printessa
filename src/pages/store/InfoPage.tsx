import { useEffect, useState } from 'react'
import { Mail, MapPin, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Setting = { key: string; value: string | null }

const SOCIAL_LABELS: Record<string, string> = {
  instagram_url: 'Instagram',
  facebook_url: 'Facebook',
  tiktok_url: 'TikTok',
}

function safeSocialUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export default function InfoPage() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    const loadSettings = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: queryError } = await supabase
          .from('store_settings')
          .select('key, value')
          .eq('is_public', true)
        if (queryError) throw queryError

        const next: Record<string, string> = {}
        ;((data as Setting[]) ?? []).forEach((row) => {
          if (row.value) next[row.key] = row.value
        })
        if (active) setSettings(next)
      } catch {
        if (active) {
          setSettings({})
          setError('Impossible de charger les informations du studio. Vérifiez votre connexion puis réessayez.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadSettings()
    return () => {
      active = false
    }
  }, [retry])

  const socials = Object.keys(SOCIAL_LABELS)
    .map((key) => ({ key, label: SOCIAL_LABELS[key], url: safeSocialUrl(settings[key] ?? '') }))
    .filter((social): social is { key: string; label: string; url: string } => Boolean(social.url))

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-offwhite">Informations</h1>

      {error && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-red/30 bg-brand-red/10 px-4 py-3 text-sm text-brand-red-light">
          <span>{error}</span>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="btn-secondary">
            Réessayer
          </button>
        </div>
      )}
      {loading && <p role="status" className="mt-4 text-sm text-charcoal-400">Chargement des informations…</p>}

      <section className="admin-card mt-6 space-y-2 text-sm text-charcoal-300">
        <h2 className="mb-2 text-lg font-semibold text-offwhite">Nous contacter</h2>
        {settings.phone ? (
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-brand-red" />
            <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="hover:text-offwhite">
              {settings.phone}
            </a>
          </p>
        ) : null}
        {settings.email ? (
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-brand-red" />
            <a href={`mailto:${settings.email}`} className="hover:text-offwhite">
              {settings.email}
            </a>
          </p>
        ) : null}
        {settings.address ? (
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand-red" />
            {settings.address}
          </p>
        ) : null}
        {!loading && !error && !settings.phone && !settings.email && !settings.address && (
          <p className="text-charcoal-400">
            Les coordonnées du studio ne sont pas encore renseignées.
          </p>
        )}

        {socials.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-2">
            {socials.map((social) => (
              <a
                key={social.key}
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-red underline-offset-4 hover:underline"
              >
                {social.label}
              </a>
            ))}
          </div>
        )}
      </section>

      {[
        { key: 'policy_terms', title: 'Conditions de vente' },
        { key: 'policy_returns', title: 'Retours et échanges' },
        { key: 'policy_privacy', title: 'Confidentialité' },
      ]
        .filter((section) => settings[section.key])
        .map((section) => (
          <section key={section.key} className="admin-card mt-4">
            <h2 className="mb-2 text-lg font-semibold text-offwhite">{section.title}</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-charcoal-300">
              {settings[section.key]}
            </p>
          </section>
        ))}
    </div>
  )
}
