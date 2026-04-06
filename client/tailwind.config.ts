import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        unoh: {
          red: '#680001',
          'red-dark': '#4a0001',
          'red-light': '#8a0001',
          white: '#ffffff',
          black: '#000000',
          gray: '#f5f5f5',
        }
      },
      fontFamily: {
        display: ['Impact', 'Arial Black', 'sans-serif'],
        body: ['Segoe UI', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-in': 'bounceIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'flash': 'flash 0.3s ease-in-out',
      },
      keyframes: {
        bounceIn: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '70%': { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        flash: {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(104, 0, 1, 0.3)' },
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

export default config
