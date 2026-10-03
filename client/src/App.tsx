import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { routes } from '@/appRoutes'

const router = createBrowserRouter(routes)

export function App() {
  return <RouterProvider router={router} />
}
