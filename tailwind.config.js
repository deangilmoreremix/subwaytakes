/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#060608', 900: '#0a0a0e', 850: '#0e0e13', 800: '#13131a', 700: '#1a1a23', 600: '#23232e' },
        line: 'rgba(255,255,255,0.07)',
        accent: { DEFAULT: '#ffb000', hot: '#ff6a00', soft: 'rgba(255,176,0,0.12)' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,176,0,0.35), 0 8px 40px -8px rgba(255,140,0,0.35)',
        panel: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pulseRing: { '0%': { transform: 'scale(.9)', opacity: '.7' }, '100%': { transform: 'scale(1.6)', opacity: '0' } },
      },
      animation: { shimmer: 'shimmer 1.6s infinite', pulseRing: 'pulseRing 1.6s ease-out infinite' },
    },
  },
  plugins: [],
};
