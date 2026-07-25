import { useReducedMotion } from 'framer-motion';

export function useAnimationConfig() {
  const reduced = useReducedMotion();
  const dur = reduced ? 0 : 1;

  return {
    pageTransition: {
      initial: { opacity: 0, y: reduced ? 0 : 12 },
      animate: { opacity: 1, y: 0, transition: { duration: 0.3 * dur, ease: [0.16, 1, 0.3, 1] } },
      exit: { opacity: 0, y: reduced ? 0 : -8, transition: { duration: 0.2 * dur } },
    },

    stagger: (delay = 0.04) => ({
      container: {
        animate: { transition: { staggerChildren: delay * dur } },
      },
      item: {
        initial: { opacity: 0, y: reduced ? 0 : 8 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.25 * dur } },
      },
    }),

    cardInteraction: {
      whileHover: reduced ? {} : { y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' },
      whileTap: reduced ? {} : { scale: 0.98 },
      transition: { type: 'spring' as const, stiffness: 400, damping: 25 },
    },

    buttonPress: {
      whileHover: reduced ? {} : { scale: 1.04 },
      whileTap: reduced ? {} : { scale: 0.96 },
      transition: { type: 'spring' as const, stiffness: 500, damping: 30 },
    },
  };
}
