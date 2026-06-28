/**
 * Thème centralisé — M.Y. Technologie & Sécurité.
 * Palette claire et lisible : fond clair, cartes blanches, texte foncé.
 * Accents : navy (#0a1f3d) + gold (#C9A227).
 * Toute couleur / espacement / typo de l'app passe par ce fichier.
 */

export const colors = {
  // Marque
  navy: '#0a1f3d',
  navyDark: '#06152a',
  navyLight: '#13315c',
  gold: '#C9A227',
  goldDark: '#a8861a',

  // Surfaces (thème clair)
  background: '#F3F5F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF1F7',

  // Texte
  text: '#0F1B2D',
  textMuted: '#5A6B82',
  textOnNavy: '#FFFFFF',
  textOnGold: '#0a1f3d',

  // Bordures / séparateurs
  border: '#D6DEEA',
  borderStrong: '#B9C5D6',

  // États
  success: '#1E8E5A',
  successBg: '#E3F4EC',
  warning: '#B8860B',
  warningBg: '#FBF3DD',
  danger: '#C0392B',
  dangerBg: '#FBE6E3',
  info: '#2563A8',
  infoBg: '#E4EEF8',

  // Divers
  overlay: 'rgba(10, 31, 61, 0.45)',
  disabled: '#9AA7B8',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  // Tailles
  h1: 28,
  h2: 22,
  h3: 18,
  body: 16,
  small: 14,
  tiny: 12,
  // Poids
  weightRegular: '400',
  weightMedium: '500',
  weightSemibold: '600',
  weightBold: '700',
} as const;

export const shadow = {
  card: {
    shadowColor: '#0a1f3d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;

export const theme = { colors, spacing, radius, typography, shadow } as const;
export type Theme = typeof theme;
