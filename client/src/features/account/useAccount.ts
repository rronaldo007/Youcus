import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { API_URL, ApiError, apiFetch } from '@/lib/api'

/** Télécharge l'export RGPD (JSON) des données personnelles. */
async function downloadExport(): Promise<void> {
  const res = await fetch(`${API_URL}/account/export`, { credentials: 'include' })
  if (!res.ok) throw new ApiError(res.status, "L'export a échoué")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'youcus-donnees.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Mutation : exporter mes données (déclenche le téléchargement). */
export function useExportData() {
  return useMutation({ mutationFn: downloadExport })
}

/** Mutation : supprimer définitivement mon compte, puis retour à l'accueil déconnecté. */
export function useDeleteAccount() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>('/account', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null)
      navigate('/')
    },
  })
}
