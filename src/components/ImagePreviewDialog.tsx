import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useImageUrl } from '@/hooks/useImageUrl'

interface ImagePreviewDialogProps {
  imageId: string
  title: string
  onClose: () => void
}

export function ImagePreviewDialog({ imageId, title, onClose }: ImagePreviewDialogProps) {
  const url = useImageUrl(imageId)
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[75dvh] min-h-40 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {url ? (
            <img src={url} alt={title} className="max-h-[75dvh] max-w-full object-contain" draggable={false} />
          ) : (
            <div className="shimmer size-40 rounded-lg" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
