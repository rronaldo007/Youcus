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
import { SearchPage } from '@/routes/search/SearchPage'

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/confidentialite', element: <PrivacyPage /> },
      { path: '/ce-qu-on-corrige', element: <WhatWeFixPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/import', element: <ImportModal /> },
      { path: '/playlists/:id', element: <PlaylistDetailPage /> },
      { path: '/playlists/:id/watch/:videoId', element: <FocusPlayerPage /> },
      { path: '/videos/:youtubeId', element: <SingleVideoPage /> },
      { path: '/recherche', element: <SearchPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
