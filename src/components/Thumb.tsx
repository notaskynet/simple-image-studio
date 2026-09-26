import { useImageUrl } from '../hooks/useImageUrl'
import type { GenerationMeta } from '../types'

interface ThumbProps {
  meta: GenerationMeta
  className?: string
}

export function Thumb({ meta, className = '' }: ThumbProps) {
  const url = useImageUrl(meta, true)
  return (
    <span className={`block overflow-hidden bg-zinc-200 dark:bg-zinc-800 ${className}`}>
      {url && <img src={url} alt="" className="size-full object-cover" draggable={false} />}
    </span>
  )
}
