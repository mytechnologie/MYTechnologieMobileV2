/**
 * Droits d'édition d'un bon, calqués sur workOrders.update du portail.
 * Technicien : statuts encore ouverts (jusqu'à en_cours inclus) et, si le
 * bon a été réparti, au plus 7 jours après dispatchedAt. On ne relâche rien :
 * le serveur reste la barrière, l'app évite seulement d'enregistrer pour rien.
 */

const TECH_ROLES = ['technician', 'technicien'];

/** Même liste que le portail (server/routers.ts, workOrders.update). */
const TECH_EDITABLE_STATUSES = ['nouveau', 'a_rappeler', 'planifie', 'en_route', 'en_cours'];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface WorkOrderEditInput {
  role: string | undefined;
  /** admin, manager, super_admin : le portail ne leur applique pas la fenêtre. */
  elevated: boolean;
  status: string;
  dispatchedAt: string | null;
  now?: number;
}

function isTech(role: string | undefined): boolean {
  return !!role && TECH_ROLES.includes(role);
}

function windowExpired(dispatchedAt: string | null, now: number): boolean {
  if (!dispatchedAt) return false;
  const dispatched = new Date(dispatchedAt).getTime();
  if (Number.isNaN(dispatched)) return false;
  return dispatched < now - SEVEN_DAYS_MS;
}

/** true si l'app peut envoyer workOrders.update. Les non-techniciens restent comme aujourd'hui. */
export function technicianMayEditWorkOrder(input: WorkOrderEditInput): boolean {
  if (input.elevated || !isTech(input.role)) return true;
  if (!TECH_EDITABLE_STATUSES.includes(input.status)) return false;
  return !windowExpired(input.dispatchedAt, input.now ?? Date.now());
}

/** Message affiché quand le technicien ne peut plus modifier. null si l'édition est permise. */
export function workOrderEditLockReason(input: WorkOrderEditInput): string | null {
  if (technicianMayEditWorkOrder(input)) return null;
  if (!TECH_EDITABLE_STATUSES.includes(input.status)) return "Ce bon n'est plus modifiable.";
  return 'La fenêtre de modification de 7 jours est fermée.';
}
