import { useEffect, useState } from 'react'

import { getImageUrl, peekImageUrl } from '../lib/db'
import type { GenerationMeta } from '../types'

export function useImageUrl(meta: GenerationMeta, enabled: boolean): string | null {
  const [url, setUrl] = useState<string | null>(() => peekImageUrl(meta))

  useEffect(() => {
    if (!enabled || url) return
    let active = true
    getImageUrl(meta)
      .then((value) => {
        if (active) setUrl(value)
      })
      .catch(() => {
        if (active) setUrl(null)
      })
    return () => {
      active = false
    }
  }, [meta, enabled, url])

  return url
}
