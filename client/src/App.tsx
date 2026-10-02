import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/components/layout/RootLayout'
import { HomePage } from '@/routes/public/HomePage'
import { PlaylistDetailPage } from '@/routes/playlists/PlaylistDetailPage'
import { FocusPlayerPage } from '@/routes/playlists/FocusPlayerPage'
import { SingleVideoPage } from '@/routes/videos/SingleVideoPage'
import { ImportModal } from '@/features/playlists/ImportModal'
import { LoginPage } from '@/routes/public/LoginPage'
import { SettingsPage } from '@/routes/settings/SettingsPage'
import { PrivacyPage } from '@/routes/public/PrivacyPage'
import { WhatWeFixPage } from '@/routes/public/WhatWeFixPage'
import { AboutPage } from '@/routes/public/AboutPage'
import { SearchPage } from '@/routes/search/SearchPage'
import { VideoNotePage } from '@/routes/notes/VideoNotePage'
import { PlaylistNotePage } from '@/routes/notes/PlaylistNotePage'
import { NotesPage } from '@/routes/notes/NotesPage'

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/confidentialite', element: <PrivacyPage /> },
      { path: '/ce-qu-on-corrige', element: <WhatWeFixPage /> },
      { path: '/a-propos', element: <AboutPage /> },
      { path: '/settings', element: <SettingsPage /> },
      // The window over the dashboard, as Figma « Import » 17:2025 draws it (YC-81).
      {
        path: '/import',
        element: (
          <>
            <HomePage />
            <ImportModal />
          </>
        ),
      },
      { path: '/playlists/:id', element: <PlaylistDetailPage /> },
      { path: '/playlists/:id/watch/:videoId', element: <FocusPlayerPage /> },
      { path: '/videos/:youtubeId', element: <SingleVideoPage /> },
      { path: '/recherche', element: <SearchPage /> },
      { path: '/notes', element: <NotesPage /> },
      { path: '/notes/videos/:videoId', element: <VideoNotePage /> },
      { path: '/notes/playlists/:id', element: <PlaylistNotePage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
