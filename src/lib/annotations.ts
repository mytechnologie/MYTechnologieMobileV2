/**
 * Constantes des marqueurs de plan — types, couleurs (tints) et statuts,
 * IDENTIQUES au web (client ProjectDetail.tsx) pour compatibilité web ↔ iPad.
 *
 * ⚠️ L'icône « camera » = caméra de SURVEILLANCE / CCTV (MaterialCommunityIcons
 * `cctv`), PAS une caméra photo/vidéo.
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type MciName = keyof typeof MaterialCommunityIcons.glyphMap;

export interface AnnotationTypeDef {
  label: string;
  icon: MciName;
  tint: string;
}

/** Ordre = ordre de la palette. Clés + tints repris du web à l'identique. */
export const ANNOTATION_TYPES: Record<string, AnnotationTypeDef> = {
  camera: { label: 'Caméra', icon: 'cctv', tint: '#EF4444' },
  access: { label: 'Lecteur accès', icon: 'key-variant', tint: '#3B82F6' },
  alarm: { label: 'Alarme', icon: 'bell-ring', tint: '#F59E0B' },
  ap: { label: 'AP WiFi', icon: 'wifi', tint: '#10B981' },
  door: { label: 'Porte', icon: 'door', tint: '#92400E' },
  note: { label: 'Note', icon: 'note-text', tint: '#EAB308' },
  electrical: { label: 'Équipement élec.', icon: 'flash', tint: '#8B5CF6' },
};

export const ANNOTATION_TYPE_KEYS = Object.keys(ANNOTATION_TYPES);

export interface StatusDef {
  label: string;
  color: string;
  emoji: string;
}

/** Statuts d'équipement (marqueurs non-note). */
export const ANNOTATION_STATUS: Record<string, StatusDef> = {
  planned: { label: 'Planifié', color: '#6B7280', emoji: '⚫' },
  in_progress: { label: 'En cours', color: '#3B82F6', emoji: '🔵' },
  installed: { label: 'Installé', color: '#F59E0B', emoji: '🟠' },
  compliant: { label: 'Conforme', color: '#10B981', emoji: '🟢' },
  issue: { label: 'Problème', color: '#EF4444', emoji: '🔴' },
};

/** Statuts spécifiques aux notes. */
export const NOTE_STATUS: Record<string, StatusDef> = {
  info: { label: 'Info', color: '#3B82F6', emoji: '🔵' },
  warning: { label: 'Avertissement', color: '#F59E0B', emoji: '🟠' },
  urgent: { label: 'Urgent', color: '#EF4444', emoji: '🔴' },
};

/** Couleur d'affichage d'un marqueur selon son statut (défaut planned). */
export function annotationStatusColor(type: string, status?: string): string {
  const table = type === 'note' ? NOTE_STATUS : ANNOTATION_STATUS;
  return table[status ?? (type === 'note' ? 'info' : 'planned')]?.color ?? '#6B7280';
}
