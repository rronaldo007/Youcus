/**
 * Lecteur focus : embarque la vidéo via la YouTube IFrame Player API, sans distraction.
 * - rel=0 : pas de recommandations d'autres chaînes en fin de lecture
 * - modestbranding=1 : branding YouTube minimal
 * - iv_load_policy=3 : pas d'annotations
 * - contrôles de lecture standards (par défaut)
 */
export function FocusPlayer({ youtubeId, title }: { youtubeId: string; title: string }) {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1',
  })
  const src = `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`

  return (
    <div className="aspect-video w-full overflow-hidden rounded-card bg-black">
      <iframe
        title={title}
        src={src}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  )
}
