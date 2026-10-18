import { useImageUrl } from '@/hooks/useImageUrl'
import { cn } from '@/lib/utils'

interface ThumbProps {
  imageId?: string
  remoteUrl?: string
  className?: string
}

export function Thumb({ imageId, remoteUrl, className }: ThumbProps) {
  const url = useImageUrl(imageId, remoteUrl)
  return (
    <span className={cn('block overflow-hidden bg-muted', className)}>
      {url && <img src={url} alt="" className="size-full object-cover" draggable={false} />}
    </span>
  )
}
