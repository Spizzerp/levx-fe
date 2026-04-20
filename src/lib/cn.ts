import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge about the project's custom @utility font-size classes
// (defined in src/style/tokens.css). Without this, twMerge groups them with
// `text-<color>` utilities and silently strips the size when both appear in
// the same cn() call.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-display-xl',
        'text-display-lg',
        'text-display-md',
        'text-display-sm',
        'text-heading',
        'text-body-lg',
        'text-body',
        'text-body-sm',
        'text-ui',
        'text-caption',
        'text-label',
        'text-micro',
        'text-nano',
        'text-value',
        'text-tag',
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
