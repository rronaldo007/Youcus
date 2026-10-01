import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlaylistCard } from './PlaylistCard'
import type { Playlist } from '@/types'

const playlist = (over: Partial<Playlist>): Playlist => ({
  id: 'p1',
  youtubeId: 'y1',
  title: 'Cours React',
  thumbnailUrl: null,
  videoCount: 17,
  ...over,
})

describe('PlaylistCard', () => {
  it('says what is left, and where the course stands (Figma 5:395)', () => {
    render(<PlaylistCard playlist={playlist({ completedCount: 3 })} channel="JavaScript Mastery" />)
    expect(screen.getByText('Cours React')).toBeInTheDocument()
    expect(screen.getByText('JavaScript Mastery')).toBeInTheDocument()
    expect(screen.getByText('14 restantes')).toBeInTheDocument()
    expect(screen.getByText('3/17')).toBeInTheDocument()
    expect(screen.getByText('● En cours')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
  })

  it('agrees « restante » in the singular', () => {
    render(<PlaylistCard playlist={playlist({ videoCount: 2, completedCount: 1 })} />)
    expect(screen.getByText('1 restante')).toBeInTheDocument()
  })

  it('shows a course not started as « À voir »', () => {
    render(<PlaylistCard playlist={playlist({ completedCount: 0 })} />)
    expect(screen.getByText('○ À voir')).toBeInTheDocument()
  })

  it('counts on playable videos only: a deleted video does not keep it unfinished (YC-13)', () => {
    render(<PlaylistCard playlist={playlist({ videoCount: 3, availableCount: 2, completedCount: 2 })} />)
    expect(screen.getByText('★ Terminée')).toBeInTheDocument()
    expect(screen.getByText('Terminée')).toBeInTheDocument()
    expect(screen.getByText('2/2')).toBeInTheDocument()
  })

  it('has no progress bar for an empty playlist', () => {
    render(<PlaylistCard playlist={playlist({ videoCount: 0 })} />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.getByText('Aucune vidéo')).toBeInTheDocument()
  })
})
