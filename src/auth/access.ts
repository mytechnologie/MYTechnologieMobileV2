/**
 * Contrôle d'accès par rôle (STRICT). Aucune comparaison `role === 'admin'` ailleurs.
 * On se base sur le rôle ET, si présentes, les permissions renvoyées par l'API.
 *
 * - technicien / admin / manager / super_admin → projets et bons ; le portail
 *   filtre ensuite ce que chacun voit (ex. « mes bons » pour un technicien).
 * - Commandes en cours : pas un onglet. Lecture si `work_orders.view_all` ou
 *   `work_orders.view_assigned` ; création / modification / suppression si
 *   `work_orders.create` / `edit` / `delete`. `super_admin` a toujours tout.
 * - Autre rôle → Accueil + Saisie d'heures uniquement.
 */
import type { AuthUser } from '../api/types';

export type Section = 'home' | 'projects' | 'work-orders' | 'customer-orders' | 'timesheet';

/** Rôles « élevés » ayant accès à toutes les sections. */
const ELEVATED_ROLES = ['admin', 'manager', 'super_admin'] as const;

/** Rôles terrain + gestion qui voient projets et bons. */
const FIELD_ROLES = ['technician', ...ELEVATED_ROLES] as const;

/** Permissions explicites qui débloquent une section (si l'API les fournit). */
const SECTION_PERMISSIONS: Record<Exclude<Section, 'customer-orders'>, readonly string[]> = {
  home: [],
  timesheet: [],
  projects: ['projects.read', 'projects.view', 'projects'],
  'work-orders': ['workOrders.read', 'workOrders.view', 'workOrders'],
};

/**
 * Codes portail des bons (server/accessControl.ts). Les commandes en cours
 * passent par ces mêmes codes — pas une copie de la règle de rôle des onglets.
 */
const CUSTOMER_ORDER_CODES = {
  read: ['work_orders.view_all', 'work_orders.view_assigned'],
  create: ['work_orders.create'],
  edit: ['work_orders.edit'],
  delete: ['work_orders.delete'],
} as const;

export type CustomerOrderAction = keyof typeof CUSTOMER_ORDER_CODES;

export function isElevated(user: Pick<AuthUser, 'role'>): boolean {
  return (ELEVATED_ROLES as readonly string[]).includes(user.role);
}

export function isSuperAdmin(user: Pick<AuthUser, 'role'>): boolean {
  return user.role === 'super_admin';
}

/** Lecture, création, modification ou suppression d'une commande en cours. */
export function canCustomerOrder(
  action: CustomerOrderAction,
  user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined,
): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  const perms = user.permissions ?? [];
  return CUSTOMER_ORDER_CODES[action].some((code) => perms.includes(code));
}

export function canAccess(
  section: Section,
  user: Pick<AuthUser, 'role' | 'permissions'>,
  mode: 'token' | null,
): boolean {
  // Accueil et saisie d'heures : accessibles à tous les utilisateurs connectés.
  if (section === 'home' || section === 'timesheet') return true;

  if (mode !== 'token') return false;

  // Commandes : codes work_orders.*, super_admin inclus dans canCustomerOrder.
  if (section === 'customer-orders') return canCustomerOrder('read', user);

  if ((FIELD_ROLES as readonly string[]).includes(user.role)) return true;

  // Sinon, on autorise si l'API a accordé une permission explicite.
  const perms = user.permissions ?? [];
  return SECTION_PERMISSIONS[section].some((p) => perms.includes(p));
}

/**
 * Sections d'onglet visibles, dans l'ordre d'affichage.
 * Les commandes en cours n'y figurent pas : l'accès se fait depuis l'accueil.
 */
export function visibleSections(
  user: Pick<AuthUser, 'role' | 'permissions'>,
  mode: 'token' | null,
): Section[] {
  const all: Section[] = ['home', 'projects', 'work-orders', 'timesheet'];
  return all.filter((s) => canAccess(s, user, mode));
}
