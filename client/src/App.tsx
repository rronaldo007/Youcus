import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/components/layout/RootLayout'
import { HomePage } from '@/routes/public/HomePage'
import { PlaylistDetailPage } from '@/routes/playlists/PlaylistDetailPage'
import { FocusPlayerPage } from '@/routes/playlists/FocusPlayerPage'

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/playlists/:id', element: <PlaylistDetailPage /> },
      { path: '/playlists/:id/watch/:videoId', element: <FocusPlayerPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
