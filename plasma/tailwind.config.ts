import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        plasma: {
          void: '#000000',
          glow: '#6366f1',
          pulse: '#8b5cf6',
          ripple: '#a855f7',
          ghost: 'rgba(255, 255, 255, 0.05)',
        }
      },
      animation: {
        'liquid-expand': 'liquidExpand 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'liquid-collapse': 'liquidCollapse 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53)',
        'droplet-rise': 'dropletRise 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        liquidExpand: {
          '0%': { transform: 'scale(0)', opacity: '0', borderRadius: '50%' },
          '50%': { borderRadius: '40%' },
          '100%': { transform: 'scale(1)', opacity: '1', borderRadius: '24px' },
        },
        liquidCollapse: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0)', opacity: '0' },
        },
        dropletRise: {
          '0%': { transform: 'translateY(20px) scale(0)', opacity: '0' },
          '60%': { transform: 'translateY(-5px) scale(1.1)' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)' },
          '50%': { boxShadow: '0 0 40px rgba(139, 92, 246, 0.8)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
