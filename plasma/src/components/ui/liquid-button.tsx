'use client'

import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

interface LiquidButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: 'primary' | 'ghost' | 'glow'
  size?: 'sm' | 'md' | 'lg' | 'fab'
}

const LiquidButton = forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const variants = {
      primary: 'bg-gradient-to-br from-plasma-glow to-plasma-pulse text-white',
      ghost: 'bg-white/5 hover:bg-white/10 text-white/80',
      glow: 'bg-plasma-glow/20 text-plasma-glow border border-plasma-glow/30',
    }

    const sizes = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-base',
      lg: 'h-12 px-6 text-lg',
      fab: 'h-16 w-16 rounded-full',
    }

    return (
      <motion.button
        ref={ref}
        className={cn(
          'relative overflow-hidden rounded-2xl font-medium transition-all duration-300',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-plasma-glow',
          variants[variant],
          sizes[size],
          className
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        {...props}
      >
        {/* Liquid ripple effect */}
        <motion.div
          className="absolute inset-0 bg-white/20 rounded-full"
          initial={{ scale: 0, opacity: 0.5 }}
          whileTap={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
        <span className="relative z-10 flex items-center justify-center gap-2">
          {children}
        </span>
      </motion.button>
    )
  }
)

LiquidButton.displayName = 'LiquidButton'

export { LiquidButton }
