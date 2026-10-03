import { useState, type FormEvent } from 'react'
import { TextField } from '@/components/ui/TextField'
import { useSaveStudyGoal, useStudyGoal } from '@/features/stats/useStats'

const MIN = 15
const MAX = 6000

/**
 * Figma « Réglages › Étude » 17:1289 (YC-79): the minutes of study aimed at each week. Saved when the
 * field is left or Entrée is pressed; empty means no goal. Not « required » as the frame draws it: a
 * goal nobody chose would be one more thing invented on the Statistiques page.
 */
export function StudyGoalSettings() {
  const goal = useStudyGoal()
  if (goal.isLoading) return <p className="text-body-15 text-content-muted">Chargement…</p>
  return <GoalField initial={goal.data?.minutes ?? null} />
}

function GoalField({ initial }: { initial: number | null }) {
  const [draft, setDraft] = useState(initial === null ? '' : String(initial))
  const [problem, setProblem] = useState<string | null>(null)
  const save = useSaveStudyGoal()

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const text = draft.trim()
    const minutes = text === '' ? null : Number(text)
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < MIN || minutes > MAX)) {
      setProblem(`Un nombre de minutes, de ${MIN} à ${MAX}.`)
      return
    }
    setProblem(null)
    if (minutes === (save.data?.minutes ?? initial)) return
    save.mutate(minutes)
  }

  const message = problem
    ? problem
    : save.isError
      ? 'Pas enregistré : réessaie.'
      : save.isSuccess
        ? save.data.minutes === null
          ? 'Enregistré : pas d’objectif.'
          : 'Enregistré.'
        : 'Laisse vide pour ne pas avoir d’objectif.'

  return (
    <form onSubmit={submit} className="w-full md:w-[340px]">
      <TextField
        label="Minutes d’étude par semaine"
        inputMode="numeric"
        placeholder="300"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => submit()}
        status={problem || save.isError ? 'error' : save.isSuccess ? 'success' : undefined}
        message={message}
      />
    </form>
  )
}
