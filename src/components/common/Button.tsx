import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark'
type Size = 'sm' | 'md' | 'lg' | 'xl'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  full?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand shadow-[0_8px_20px_-8px_var(--brand-primary)] hover:brightness-110 active:brightness-95',
  secondary: 'bg-card text-ink border border-line shadow-card hover:border-ink/25 hover:bg-white',
  ghost: 'text-ink-soft hover:bg-ink/5',
  danger: 'bg-danger text-white hover:brightness-110 shadow-[0_8px_20px_-10px_#c62f2f]',
  dark: 'bg-ink text-white hover:bg-ink-soft',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'h-13 px-6 text-base gap-2.5 rounded-xl',
  xl: 'h-16 px-8 text-lg gap-3 rounded-2xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, full, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex select-none items-center justify-center font-semibold transition-[transform,filter,background-color,border-color,box-shadow] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 ${variants[variant]} ${sizes[size]} ${full ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})
