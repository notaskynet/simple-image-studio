import { useEffect, useState } from 'react'

import { getImageUrl, peekImageUrl } from '../lib/db'

export function useImageUrl(imageId: string | undefined, remoteUrl?: string): string | null {
  const [state, setState] = useState<{ key: string; url: string | null }>(() => ({
    key: `${imageId}|${remoteUrl}`,
    url: peekImageUrl(imageId),
  }))
  const key = `${imageId}|${remoteUrl}`

  useEffect(() => {
    if (!imageId && !remoteUrl) return
    let active = true
    getImageUrl(imageId, remoteUrl)
      .then((url) => {
        if (active) setState({ key, url })
      })
      .catch(() => {
        if (active) setState({ key, url: null })
      })
    return () => {
      active = false
    }
  }, [imageId, remoteUrl, key])

  if (state.key === key) return state.url ?? peekImageUrl(imageId)
  return peekImageUrl(imageId)
}
