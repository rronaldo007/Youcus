import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { VideoSidebar } from './VideoSidebar'
import type { Video } from '@/types'

const videos: Video[] = [
  { id: 'v1', youtubeId: 'y1', title: 'Intro', thumbnailUrl: null, position: 0, durationSeconds: 0 },
  { id: 'v2', youtubeId: 'y2', title: 'Chapitre 2', thumbnailUrl: null, position: 1, durationSeconds: 0 },
]

describe('VideoSidebar', () => {
  it('liste les vidéos, marque la vidéo en cours et lie vers chaque vidéo', () => {
    render(
      <MemoryRouter>
        <VideoSidebar playlistId="p1" videos={videos} currentVideoId="y2" />
      </MemoryRouter>,
    )
    expect(screen.getByText('Intro')).toBeInTheDocument()

    const current = screen.getByText('Chapitre 2').closest('a')
    expect(current).toHaveAttribute('aria-current', 'true')
    expect(current).toHaveAttribute('href', '/playlists/p1/watch/y2')

    expect(screen.getByText('Intro').closest('a')).not.toHaveAttribute('aria-current')
  })
})
