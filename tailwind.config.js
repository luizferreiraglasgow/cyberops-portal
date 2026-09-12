/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Flat tokens used by the platform dashboard (home)
        'cyber-bg': '#0a0e1a',
        'cyber-card': '#111827',
        'cyber-border': '#1f2937',
        'cyber-green': '#00ff88',
        'cyber-red': '#ff4444',
        'cyber-blue': '#00aaff',
        'cyber-yellow': '#ffcc00',
        'cyber-purple': '#aa66ff',
        'cyber-orange': '#ff8800',
        // Nested tokens used elsewhere in the app
        cyber: {
          dark: '#0a0e1a',
          card: '#0f1629',
          border: '#1e3a5f',
          accent: '#00d4ff',
          green: '#00ff9d',
          red: '#ff4444',
          yellow: '#ffcc00',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
