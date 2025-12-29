'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { LiquidDock, OpenWindow, DockItem } from './liquid-dock'
import { cn } from '@/lib/utils'

const windowContent: Record<string, { description: string }> = {
  home: { description: 'Welcome to your dashboard. Everything starts here.' },
  edit: { description: 'Create and edit your content with powerful tools.' },
  chat: { description: 'Real-time messaging and collaboration.' },
  mention: { description: 'See all your notifications and mentions.' },
}

// Opacity settings
const MIN_OPACITY = 0.08  // Very transparent when opened
const MAX_OPACITY = 0.65  // Maximum opacity (never fully opaque)
const OPACITY_STEP = 0.08 // Increase per 10 seconds
const OPACITY_INTERVAL = 10000 // 10 seconds

export function PlasmaInterface() {
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([])
  const [hoveredWindowId, setHoveredWindowId] = useState<string | null>(null)
  const [, forceUpdate] = useState(0) // For triggering re-renders
  const focusCounter = useRef(100)

  // Update opacity every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      forceUpdate(n => n + 1)
    }, OPACITY_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  // Calculate opacity based on window age
  const getWindowOpacity = (window: OpenWindow) => {
    const age = Date.now() - window.createdAt
    const steps = Math.floor(age / OPACITY_INTERVAL)
    return Math.min(MIN_OPACITY + steps * OPACITY_STEP, MAX_OPACITY)
  }

  // Open a new window
  const handleOpenWindow = (item: DockItem) => {
    focusCounter.current += 1
    const newWindow: OpenWindow = {
      id: `${item.id}-${Date.now()}`,
      item,
      zIndex: focusCounter.current,
      createdAt: Date.now(),
    }
    setOpenWindows(prev => [...prev, newWindow])
  }

  // Close a window
  const handleCloseWindow = (id: string) => {
    setOpenWindows(prev => prev.filter(w => w.id !== id))
    if (hoveredWindowId === id) {
      setHoveredWindowId(null)
    }
  }

  // Permanently focus a window (on click)
  const handleFocusWindow = (id: string) => {
    focusCounter.current += 1
    const newZ = focusCounter.current
    setOpenWindows(prev => prev.map(w =>
      w.id === id ? { ...w, zIndex: newZ } : w
    ))
  }

  // Temporarily hover a window
  const handleHoverWindow = (id: string | null) => {
    setHoveredWindowId(id)
  }

  // Calculate display z-index: hovered window gets 9000, others use their stored zIndex
  const getDisplayZIndex = (window: OpenWindow) => {
    return hoveredWindowId === window.id ? 9000 : window.zIndex
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <motion.div
          className="absolute inset-0 opacity-60"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 20% 40%, rgba(45, 212, 191, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 60%, rgba(56, 189, 248, 0.12) 0%, transparent 50%),
              radial-gradient(ellipse 50% 30% at 50% 80%, rgba(232, 121, 249, 0.1) 0%, transparent 50%)
            `,
          }}
          animate={{ opacity: [0.4, 0.6, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[800px] h-[800px] rounded-full opacity-20 blur-3xl"
          style={{
            background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.3) 0%, rgba(56, 189, 248, 0.2) 50%, transparent 100%)',
            top: '-20%',
            left: '-10%',
          }}
          animate={{ x: [0, 100, 0], y: [0, 50, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full opacity-15 blur-3xl"
          style={{
            background: 'linear-gradient(135deg, rgba(192, 132, 252, 0.3) 0%, rgba(232, 121, 249, 0.2) 50%, transparent 100%)',
            bottom: '-10%',
            right: '-10%',
          }}
          animate={{ x: [0, -80, 0], y: [0, -60, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Main content - center logo */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <motion.div
            className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-3xl"
            style={{
              background: 'linear-gradient(135deg, rgba(45, 212, 191, 0.2) 0%, rgba(232, 121, 249, 0.2) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
            animate={{
              boxShadow: [
                '0 0 30px rgba(45, 212, 191, 0.3)',
                '0 0 50px rgba(232, 121, 249, 0.3)',
                '0 0 30px rgba(45, 212, 191, 0.3)',
              ],
            }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <Sparkles className="w-10 h-10 text-white/80" />
          </motion.div>
          <h1 className="text-4xl font-light mb-3 text-white/90 tracking-wide">
            Plasma
          </h1>
          <p className="text-base text-white/40 max-w-sm mx-auto">
            Liquid interface for the next generation
          </p>
        </motion.div>
      </div>

      {/* Floating Windows */}
      <AnimatePresence>
        {openWindows.map((window, windowIndex) => {
          const Icon = window.item.icon
          const content = windowContent[window.item.id]
          const isHovered = hoveredWindowId === window.id

          return (
            <motion.div
              key={window.id}
              className={cn(
                'fixed',
                'w-80 rounded-3xl overflow-hidden',
                'backdrop-blur-xl',
                'border border-white/10',
                'shadow-2xl shadow-black/50'
              )}
              style={{
                zIndex: getDisplayZIndex(window),
                background: `rgba(15, 15, 20, ${getWindowOpacity(window)})`,
                top: '20%',
                left: `calc(30% + ${windowIndex * 30}px)`,
                boxShadow: isHovered
                  ? `0 0 40px ${window.item.glowColor}, 0 25px 50px rgba(0,0,0,0.3)`
                  : '0 25px 50px rgba(0,0,0,0.3)',
              }}
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              drag
              dragMomentum={false}
              onPointerDown={() => handleFocusWindow(window.id)}
            >
              {/* Gradient border glow */}
              <div
                className="absolute -inset-px rounded-3xl pointer-events-none transition-opacity duration-300"
                style={{
                  background: `linear-gradient(135deg, ${window.item.color.replace('0.85', '0.3')} 0%, transparent 50%, ${window.item.color.replace('0.85', '0.2')} 100%)`,
                  opacity: isHovered ? 1 : 0.5,
                }}
              />

              {/* Header */}
              <div
                className="relative flex items-center justify-between p-4 border-b border-white/10"
                style={{ background: window.item.color.replace('0.85', '0.2') }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: window.item.color }}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-medium text-white/90">
                    {window.item.label}
                  </span>
                </div>
                <motion.button
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    'bg-white/5 hover:bg-red-500/50',
                    'text-white/50 hover:text-white',
                    'transition-colors duration-200'
                  )}
                  onClick={() => handleCloseWindow(window.id)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Content */}
              <div className="relative p-6">
                <p className="text-white/60 mb-6">
                  {content?.description}
                </p>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="h-10 rounded-xl"
                      style={{ background: window.item.color.replace('0.85', '0.1') }}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* Liquid Dock */}
      <LiquidDock
        openWindows={openWindows}
        onOpenWindow={handleOpenWindow}
        onCloseWindow={handleCloseWindow}
        onFocusWindow={handleFocusWindow}
        onHoverWindow={handleHoverWindow}
      />
    </div>
  )
}
