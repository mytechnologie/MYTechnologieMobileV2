/**
 * Contrôle d'accès par rôle (STRICT). Aucune comparaison `role === 'admin'` ailleurs.
 * On se base sur le rôle ET, si présentes, les permissions renvoyées par l'API.
 *
 * - Employé régulier (technician, employee, …) → Accueil + Saisie d'heures uniquement.
 * - admin / manager / super_admin → les 4 sections.
 *
 * Projets et bons passent par l'auth admin du portail (cookie, pas la session
 * portail). Connecté par code SMS, même un admin n'y a donc pas accès : ces
 * appels répondraient 401 et forceraient la déconnexion. Voir `mode`.
 */
import type { AuthUser } from '../api/types';

export type Section = 'home' | 'projects' | 'work-orders' | 'timesheet';

/** Rôles « élevés » ayant accès à toutes les sections. */
const ELEVATED_ROLES = ['admin', 'manager', 'super_admin'] as const;

/** Permissions explicites qui débloquent une section (si l'API les fournit). */
const SECTION_PERMISSIONS: Record<Section, string[]> = {
  home: [],
  timesheet: [],
  projects: ['projects.read', 'projects.view', 'projects'],
  'work-orders': ['workOrders.read', 'workOrders.view', 'workOrders'],
};

export function isElevated(user: Pick<AuthUser, 'role'>): boolean {
  return (ELEVATED_ROLES as readonly string[]).includes(user.role);
}

export function canAccess(
  section: Section,
  user: Pick<AuthUser, 'role' | 'permissions'>,
  mode: 'employee' | 'admin' | null,
): boolean {
  // Accueil et saisie d'heures : accessibles à tous les utilisateurs connectés.
  if (section === 'home' || section === 'timesheet') return true;

  // Sections admin : seulement avec une session admin.
  if (mode !== 'admin') return false;

  // Rôles élevés : accès complet.
  if (isElevated(user)) return true;

  // Sinon, on autorise si l'API a accordé une permission explicite.
  const perms = user.permissions ?? [];
  return SECTION_PERMISSIONS[section].some((p) => perms.includes(p));
}

/** Sections visibles pour cet utilisateur, dans l'ordre d'affichage. */
export function visibleSections(
  user: Pick<AuthUser, 'role' | 'permissions'>,
  mode: 'employee' | 'admin' | null,
): Section[] {
  const all: Section[] = ['home', 'projects', 'work-orders', 'timesheet'];
  return all.filter((s) => canAccess(s, user, mode));
}
