import { cn } from '@/lib/utils'

/** Размытый переливающийся градиент — стиль ожидания генерации, как в ChatGPT. */
export function GradientLoader({ className }: { className?: string }) {
  return (
    <div className={cn('gen-loader relative overflow-hidden bg-muted', className)} aria-hidden="true">
      <span className="gen-blob gen-blob-1" />
      <span className="gen-blob gen-blob-2" />
      <span className="gen-blob gen-blob-3" />
      <span className="gen-blob gen-blob-4" />
      <span className="gen-grain" />
      <span className="gen-sweep" />
    </div>
  )
}
