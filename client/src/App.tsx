import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/components/layout/RootLayout'
import { HomePage } from '@/routes/public/HomePage'
import { PlaylistDetailPage } from '@/routes/playlists/PlaylistDetailPage'

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/playlists/:id', element: <PlaylistDetailPage /> },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
