export function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        You<span className="text-brand-purple">cus</span>
      </h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400">
        Une couche d'étude sans distraction par-dessus YouTube : playlists, lecteur
        focus, notes Markdown et suivi de progression.
      </p>
      <a
        href="/api/auth/google"
        className="rounded-card bg-brand-purple px-6 py-3 font-semibold text-white transition hover:bg-brand-purple-dark"
      >
        Se connecter avec Google
      </a>
    </main>
  )
}
