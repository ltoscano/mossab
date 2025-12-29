'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface DropletItem {
  id: string
  icon: LucideIcon
  label: string
  color?: string
  onClick?: () => void
}

interface DropletMenuProps {
  items: DropletItem[]
  isOpen: boolean
  onItemClick?: (item: DropletItem) => void
}

export function DropletMenu({ items, isOpen, onItemClick }: DropletMenuProps) {
  // Calculate positions in a liquid-like arc formation
  const getDropletPosition = (index: number, total: number) => {
    const baseAngle = Math.PI / 2 // Start from bottom
    const spread = Math.PI * 0.6 // Arc spread
    const angle = baseAngle + spread / 2 - (spread / (total - 1 || 1)) * index
    const radius = 100 + (index % 2) * 20 // Varied radius for organic feel

    return {
      x: Math.cos(angle) * radius,
      y: -Math.sin(angle) * radius,
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute bottom-20 right-0">
          {items.map((item, index) => {
            const pos = getDropletPosition(index, items.length)
            const Icon = item.icon

            return (
              <motion.button
                key={item.id}
                className={cn(
                  'absolute flex items-center justify-center',
                  'w-14 h-14 rounded-full',
                  'glass-strong shadow-lg shadow-black/50',
                  'hover:scale-110 transition-transform duration-200',
                  'group'
                )}
                style={{
                  background: item.color
                    ? `linear-gradient(135deg, ${item.color}40, ${item.color}20)`
                    : undefined,
                }}
                initial={{
                  x: 0,
                  y: 0,
                  scale: 0,
                  opacity: 0,
                }}
                animate={{
                  x: pos.x,
                  y: pos.y,
                  scale: 1,
                  opacity: 1,
                }}
                exit={{
                  x: 0,
                  y: 0,
                  scale: 0,
                  opacity: 0,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 400,
                  damping: 25,
                  delay: index * 0.05,
                }}
                onClick={() => {
                  item.onClick?.()
                  onItemClick?.(item)
                }}
                whileHover={{
                  boxShadow: `0 0 30px ${item.color || 'rgba(99, 102, 241, 0.5)'}`,
                }}
              >
                <Icon
                  className={cn(
                    'w-6 h-6 transition-colors duration-200',
                    item.color ? 'text-white' : 'text-white/80 group-hover:text-white'
                  )}
                />

                {/* Tooltip */}
                <motion.span
                  className={cn(
                    'absolute right-full mr-3 px-3 py-1.5 rounded-lg',
                    'text-sm font-medium whitespace-nowrap',
                    'glass-strong opacity-0 group-hover:opacity-100',
                    'pointer-events-none transition-opacity duration-200'
                  )}
                >
                  {item.label}
                </motion.span>
              </motion.button>
            )
          })}
        </div>
      )}
    </AnimatePresence>
  )
}
