export const theme = {
  colors: {
    background: '#050A1F',
    surface: 'rgba(25, 30, 55, 0.45)',
    surfaceHover: 'rgba(25, 30, 55, 0.75)',
    surfaceSolid: '#0E132A',
    primary: '#00E5FF', // Neon Cyan
    secondary: '#2979FF', // Cyber Blue
    accent: '#FF007F', // Electric Pink
    text: '#FFFFFF',
    textSecondary: '#A0AEC0',
    border: 'rgba(0, 229, 255, 0.2)',
    borderHover: 'rgba(0, 229, 255, 0.55)',
    glass: 'rgba(11, 19, 43, 0.5)',
  },
  glow: {
    primary: '0 0 15px rgba(0, 229, 255, 0.5)',
    secondary: '0 0 20px rgba(41, 121, 255, 0.55)',
    accent: '0 0 15px rgba(255, 0, 127, 0.5)',
  },
  gradients: {
    cyber: 'linear-gradient(135deg, #00E5FF 0%, #2979FF 50%, #FF007F 100%)',
    bg: 'radial-gradient(circle at top right, rgba(0, 229, 255, 0.08), transparent 45%), radial-gradient(circle at bottom left, rgba(255, 0, 127, 0.06), transparent 50%)',
  }
};

export type Theme = typeof theme;
