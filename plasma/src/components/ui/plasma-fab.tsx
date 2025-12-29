'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DropletMenu } from './droplet-menu'
import { LucideIcon } from 'lucide-react'

interface MenuItem {
  id: string
  icon: LucideIcon
  label: string
  color?: string
  onClick?: () => void
}

interface PlasmaFabProps {
  items: MenuItem[]
  onItemClick?: (item: MenuItem) => void
}

export function PlasmaFab({ items, onItemClick }: PlasmaFabProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleItemClick = (item: MenuItem) => {
    setIsOpen(false)
    onItemClick?.(item)
  }

  return (
    <div className="fixed bottom-8 right-8 z-30">
      {/* Droplet Menu */}
      <DropletMenu
        items={items}
        isOpen={isOpen}
        onItemClick={handleItemClick}
      />

      {/* Main FAB Button */}
      <motion.button
        className={cn(
          'relative flex items-center justify-center',
          'w-16 h-16 rounded-full',
          'bg-gradient-to-br from-plasma-glow to-plasma-pulse',
          'shadow-lg shadow-plasma-glow/30',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-plasma-glow focus-visible:ring-offset-2 focus-visible:ring-offset-black'
        )}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={isOpen ? { rotate: 45 } : { rotate: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        {/* Pulsing glow */}
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-plasma-glow to-plasma-pulse"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Icon */}
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-7 h-7 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Plus className="w-7 h-7 text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
