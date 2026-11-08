/**
 * Détection de la taille d'écran pour le layout adaptatif (téléphone vs tablette).
 *
 * L'app est UN SEUL projet Expo : les écrans/données sont partagés, seul le
 * CONTENEUR de layout change. Sur grand écran (iPad, surtout en paysage) on
 * bascule en master-détail (liste + détail côte à côte) ; sinon navigation pile.
 */
import { Platform, useWindowDimensions } from 'react-native';

/** Seuil (px) au-delà duquel on affiche deux panneaux côte à côte. */
export const TWO_PANE_MIN_WIDTH = 800;

export interface Responsive {
  width: number;
  height: number;
  /** Appareil de type tablette (iPad, ou large Android). */
  isTablet: boolean;
  /** Assez large MAINTENANT pour un master-détail (dépend de l'orientation). */
  twoPane: boolean;
  landscape: boolean;
}

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isPad = Platform.OS === 'ios' ? Platform.isPad === true : Math.min(width, height) >= 600;
  return {
    width,
    height,
    isTablet: isPad || Math.min(width, height) >= 600,
    twoPane: width >= TWO_PANE_MIN_WIDTH,
    landscape: width > height,
  };
}
