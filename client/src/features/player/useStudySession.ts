import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { CaptionTrack, FocusPlayerHandle } from '@/features/player/FocusPlayer'
import type { SaveSentence } from '@/features/player/EndCard'
import { readStudyPreferences, saveStudyPreferences } from '@/features/player/studyPreferences'
import type { NoteActions } from '@/features/notes/NoteEditor'

/**
 * What a player page holds around the video, shared by the playlist player and the single video
 * one (YC-61): the position (YC-6), the study controls (YC-59) and the end card (YC-60).
 * `videoKey` changes with the video: the position and the end card start again.
 */
export function useStudySession(videoKey: string) {
  // Player position, for the chapter playing (YC-6), and a handle to move the player.
  const playerRef = useRef<FocusPlayerHandle>(null)
  const [currentSeconds, setCurrentSeconds] = useState(0)
  const seek = useCallback((seconds: number) => playerRef.current?.seekTo(seconds), [])
  // The end card (YC-60): shown when the video ends, gone as soon as it plays again.
  const [endedAt, setEndedAt] = useState<number | null>(null)
  const noteActions = useRef<NoteActions | null>(null)
  useEffect(() => {
    setCurrentSeconds(0)
    setEndedAt(null)
  }, [videoKey])
  // « Lire la suivante » asked for this video: it plays as soon as it is ready.
  const autoplay = (useLocation().state as { autoplay?: boolean } | null)?.autoplay === true
  const replay = useCallback(() => {
    setEndedAt(null)
    playerRef.current?.restart()
  }, [])
  const saveSentence = useCallback<SaveSentence>(
    (text, done) => (endedAt === null ? false : (noteActions.current?.appendMarkedLine(text, endedAt, done) ?? false)),
    [endedAt],
  )
  // Study controls (YC-59): the speed and the captions stay from one video and one visit to the next.
  const [rate, setRate] = useState(() => readStudyPreferences().rate)
  const [captions, setCaptions] = useState<string | null>(() => readStudyPreferences().captions)
  useEffect(() => saveStudyPreferences({ rate, captions }), [rate, captions])
  const [tracks, setTracks] = useState<CaptionTrack[] | null>(null)
  const chooseRate = useCallback((next: number) => {
    setRate(next)
    playerRef.current?.setRate(next)
  }, [])
  const chooseCaptions = useCallback((code: string | null) => {
    setCaptions(code)
    playerRef.current?.setCaptions(code)
  }, [])
  const studyPlayer = useMemo(
    () => ({ seekBy: (delta: number) => playerRef.current?.seekBy(delta), togglePlay: () => playerRef.current?.togglePlay() }),
    [],
  )
  const onCaptionTracks = useCallback((list: CaptionTrack[] | null, shown: string | null) => {
    setTracks(list)
    // « On » chosen before the tracks were known: the menu now names the language shown.
    if (shown) setCaptions((c) => (c === '' ? shown : c))
  }, [])

  return {
    playerRef,
    currentSeconds,
    setCurrentSeconds,
    seek,
    endedAt,
    setEndedAt,
    noteActions,
    autoplay,
    replay,
    saveSentence,
    rate,
    setRate,
    captions,
    tracks,
    chooseRate,
    chooseCaptions,
    studyPlayer,
    onCaptionTracks,
  }
}
