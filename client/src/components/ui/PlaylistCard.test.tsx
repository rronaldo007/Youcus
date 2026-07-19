import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlaylistCard } from './PlaylistCard'

describe('PlaylistCard', () => {
  it('affiche le titre et le nombre de vidéos', () => {
    render(
      <PlaylistCard
        playlist={{ id: 'p1', youtubeId: 'y1', title: 'Cours React', thumbnailUrl: null, videoCount: 12 }}
      />,
    )
    expect(screen.getByText('Cours React')).toBeInTheDocument()
    expect(screen.getByText(/12 vidéos/)).toBeInTheDocument()
  })

  it('accorde « vidéo » au singulier', () => {
    render(
      <PlaylistCard
        playlist={{ id: 'p2', youtubeId: 'y2', title: 'Solo', thumbnailUrl: null, videoCount: 1 }}
      />,
    )
    expect(screen.getByText('1 vidéo')).toBeInTheDocument()
  })
})
