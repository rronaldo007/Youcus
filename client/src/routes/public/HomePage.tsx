import { useState } from 'react'
import { useCurrentUser } from '@/features/auth/useCurrentUser'
import { Button } from '@/components/ui/Button'
import { ImportPlaylistForm } from '@/features/playlists/ImportPlaylistForm'
import { PlaylistLibrary } from '@/features/playlists/PlaylistLibrary'
import { LandingPage } from '@/routes/public/LandingPage'

export function HomePage() {
  const { data: user, isLoading } = useCurrentUser()
  const [importing, setImporting] = useState(false)

  if (isLoading) return null
  // Visiteur non connecté → page d'accueil (landing).
  if (!user) return <LandingPage />

  // Utilisateur connecté → tableau de bord (cf. Figma Dashboard 35:174).
  return (
    <main className="px-6 py-8 sm:px-10 lg:px-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-content sm:text-[28px]">Mes playlists</h1>
        <Button onClick={() => setImporting((v) => !v)}>+ Importer une playlist</Button>
      </div>

      {importing && (
        <div className="mt-4 rounded-card border border-line bg-surface p-4">
          <ImportPlaylistForm />
        </div>
      )}

      <div className="mt-6">
        <PlaylistLibrary onImport={() => setImporting(true)} />
      </div>
    </main>
  )
}
