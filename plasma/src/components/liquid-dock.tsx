'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Pencil,
  MessageSquare,
  AtSign,
  Menu,
  X,
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'

export interface DockItem {
  id: string
  icon: LucideIcon
  label: string
  color: string
  glowColor: string
}

const dockItems: DockItem[] = [
  { id: 'home', icon: Home, label: 'Home', color: 'rgba(45, 212, 191, 0.85)', glowColor: 'rgba(45, 212, 191, 0.6)' },
  { id: 'edit', icon: Pencil, label: 'Edit', color: 'rgba(56, 189, 248, 0.85)', glowColor: 'rgba(56, 189, 248, 0.6)' },
  { id: 'chat', icon: MessageSquare, label: 'Chat', color: 'rgba(129, 140, 248, 0.85)', glowColor: 'rgba(129, 140, 248, 0.6)' },
  { id: 'mention', icon: AtSign, label: 'Mentions', color: 'rgba(192, 132, 252, 0.85)', glowColor: 'rgba(192, 132, 252, 0.6)' },
]

export interface OpenWindow {
  id: string
  item: DockItem
  zIndex: number
  createdAt: number
}

interface LiquidDockProps {
  openWindows: OpenWindow[]
  onOpenWindow: (item: DockItem) => void
  onCloseWindow: (id: string) => void
  onFocusWindow: (id: string) => void
  onHoverWindow: (id: string | null) => void
}

export function LiquidDock({
  openWindows,
  onOpenWindow,
  onCloseWindow,
  onFocusWindow,
  onHoverWindow,
}: LiquidDockProps) {
  const [isDockOpen, setIsDockOpen] = useState(false)
  const [hoveredStackItem, setHoveredStackItem] = useState<string | null>(null)

  const availableItems = dockItems.filter(
    item => !openWindows.some(w => w.item.id === item.id)
  )

  const allItemsOpen = availableItems.length === 0

  const handleDockItemClick = (item: DockItem) => {
    onOpenWindow(item)
    // Keep dock open - only close explicitly via main button
    // Auto-close only when no more items available (will happen on next render)
  }

  const handleStackClick = (windowId: string) => {
    onFocusWindow(windowId)
  }

  const handleStackHover = (windowId: string | null) => {
    setHoveredStackItem(windowId)
    onHoverWindow(windowId)
  }

  const handleStackClose = (windowId: string) => {
    onCloseWindow(windowId)
    setHoveredStackItem(null)
  }

  return (
    <div className="fixed bottom-8 right-8 z-[9999] flex flex-col items-end">
      {/* Stacked open windows - centered with main button (w-12 = 48px) */}
      <div className="flex flex-col-reverse items-center gap-3 mb-3 w-12">
        <AnimatePresence>
          {openWindows.map((window, index) => {
            const Icon = window.item.icon
            const isHovered = hoveredStackItem === window.id

            return (
              <motion.div
                key={window.id}
                className="relative"
                initial={{ scale: 0, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0, y: 20, opacity: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                  delay: index * 0.03,
                }}
                onMouseEnter={() => handleStackHover(window.id)}
                onMouseLeave={() => handleStackHover(null)}
              >
                <AnimatePresence>
                  {isHovered && (
                    <motion.button
                      className="absolute -top-0.5 -right-0.5 z-10 w-3.5 h-3.5 rounded-full"
                      style={{
                        background: 'rgba(255, 59, 48, 0.95)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                      }}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStackClose(window.id)
                      }}
                    />
                  )}
                </AnimatePresence>

                <motion.button
                  className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{
                    background: isHovered ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: `1px solid ${isHovered ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}`,
                    boxShadow: isHovered
                      ? `0 0 20px ${window.item.glowColor}, 0 4px 20px rgba(0,0,0,0.3)`
                      : '0 4px 20px rgba(0,0,0,0.2)',
                  }}
                  onClick={() => handleStackClick(window.id)}
                  whileTap={{ scale: 0.92 }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: isHovered ? window.item.color.replace('0.85', '1') : 'rgba(255,255,255,0.9)' }}
                  />
                </motion.button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Liquid Dock */}
      <AnimatePresence>
        {!allItemsOpen && (
          <motion.div
            className="relative flex items-center"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* Gooey filter for liquid effect */}
            <svg className="absolute" style={{ width: 0, height: 0 }}>
              <defs>
                <filter id="goo">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
                  <feColorMatrix
                    in="blur"
                    mode="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -9"
                    result="goo"
                  />
                  <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                </filter>
              </defs>
            </svg>

            {/* Liquid blob container */}
            <div
              className="relative flex items-center"
              style={{ filter: 'url(#goo)' }}
            >
              {/* Background blobs that merge */}
              <motion.div
                className="absolute right-0 h-12 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                }}
                animate={{
                  width: isDockOpen ? 48 + availableItems.length * 48 : 48,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 100,
                  damping: 15,
                }}
              />

              {/* Individual circle blobs */}
              <AnimatePresence>
                {isDockOpen && availableItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    className="absolute right-0 w-12 h-12 rounded-full"
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                    }}
                    initial={{ x: 0, scale: 0 }}
                    animate={{ x: -(index + 1) * 48, scale: 1 }}
                    exit={{ x: 0, scale: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 100,
                      damping: 15,
                      delay: index * 0.05,
                    }}
                  />
                ))}
              </AnimatePresence>

              {/* Main button blob */}
              <div
                className="relative w-12 h-12 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                }}
              />
            </div>

            {/* Glass overlay with blur - on top of goo effect */}
            <motion.div
              className="absolute right-0 h-12 rounded-full pointer-events-none"
              style={{
                backdropFilter: 'blur(20px) saturate(150%)',
                WebkitBackdropFilter: 'blur(20px) saturate(150%)',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: `
                  0 4px 24px rgba(0,0,0,0.2),
                  inset 0 1px 0 rgba(255,255,255,0.3),
                  inset 0 -1px 0 rgba(0,0,0,0.1)
                `,
              }}
              animate={{
                width: isDockOpen ? 48 + availableItems.length * 48 : 48,
              }}
              transition={{
                type: 'spring',
                stiffness: 100,
                damping: 15,
              }}
            />

            {/* Icons layer */}
            <div className="relative flex items-center">
              {/* Dock item icons */}
              <AnimatePresence>
                {isDockOpen && availableItems.map((item, index) => {
                  const Icon = item.icon
                  return (
                    <motion.button
                      key={item.id}
                      className="absolute right-0 w-12 h-12 rounded-full flex items-center justify-center"
                      initial={{ x: 0, opacity: 0, scale: 0.5 }}
                      animate={{ x: -(index + 1) * 48, opacity: 1, scale: 1 }}
                      exit={{ x: 0, opacity: 0, scale: 0.5 }}
                      transition={{
                        type: 'spring',
                        stiffness: 150,
                        damping: 18,
                        delay: index * 0.06,
                      }}
                      onClick={() => handleDockItemClick(item)}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Icon className="w-5 h-5 text-white/90" />
                    </motion.button>
                  )
                })}
              </AnimatePresence>

              {/* Main trigger button */}
              <motion.button
                className="relative w-12 h-12 rounded-full flex items-center justify-center z-10"
                onClick={() => setIsDockOpen(!isDockOpen)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <motion.div
                  animate={{ rotate: isDockOpen ? 45 : 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  {isDockOpen ? (
                    <X className="w-5 h-5 text-white/90" />
                  ) : (
                    <Menu className="w-5 h-5 text-white/90" />
                  )}
                </motion.div>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { dockItems }
