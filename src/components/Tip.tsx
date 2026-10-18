import type { ReactElement } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface TipProps {
  label: string
  children: ReactElement
  side?: 'top' | 'bottom' | 'left' | 'right'
}

/** Подсказка при наведении. Триггер — обёртка, поэтому она показывается и на отключённых кнопках. */
export function Tip({ label, children, side }: TipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
