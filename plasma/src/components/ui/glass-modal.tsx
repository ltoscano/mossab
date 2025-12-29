'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface GlassModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children?: ReactNode
  className?: string
}

export function GlassModal({
  isOpen,
  onClose,
  title,
  children,
  className
}: GlassModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={cn(
                'relative w-full max-w-lg overflow-hidden rounded-3xl',
                'glass-strong',
                'shadow-2xl shadow-black/50',
                className
              )}
              initial={{
                scale: 0.8,
                y: 50,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                y: 0,
                opacity: 1,
              }}
              exit={{
                scale: 0.8,
                y: 50,
                opacity: 0,
              }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Glow effect */}
              <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-plasma-glow/20 via-transparent to-plasma-pulse/20 pointer-events-none" />

              {/* Header */}
              <div className="relative flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-semibold text-white/90">
                  {title}
                </h2>
                <motion.button
                  className={cn(
                    'flex items-center justify-center',
                    'w-10 h-10 rounded-full',
                    'bg-white/5 hover:bg-white/10',
                    'text-white/60 hover:text-white',
                    'transition-colors duration-200'
                  )}
                  onClick={onClose}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              {/* Content */}
              <div className="relative p-6">
                {children}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
