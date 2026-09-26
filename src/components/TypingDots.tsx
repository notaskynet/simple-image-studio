interface TypingDotsProps {
  className?: string
}

export function TypingDots({ className = '' }: TypingDotsProps) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} aria-hidden="true">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-2 animate-typing-dot rounded-full bg-current"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  )
}
