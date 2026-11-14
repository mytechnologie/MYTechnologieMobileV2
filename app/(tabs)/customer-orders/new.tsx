/**
 * Création ou modification d'une commande.
 * Client via clients.list. Quantité : entier > 0. Au moins une ligne
 * (l'API accepterait un tableau vide, le formulaire non). Aucun prix.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, SectionTitle, TextField } from '../../../src/components/Primitives';
import { Screen } from '../../../src/components/Screen';
import { EntityPicker } from '../../../src/components/EntityPicker';
import { clients as clientsApi, customerOrders } from '../../../src/api/endpoints';
import { useMutation, useQuery } from '../../../src/api/useApi';
import { useAuth } from '../../../src/auth/AuthContext';
import { canCustomerOrder } from '../../../src/auth/access';
import { ErrorState, LoadingState } from '../../../src/components/States';
import { formatOrderDate, toISODate } from '../../../src/lib/format';
import type { CustomerOrderLineInput } from '../../../src/api/types';
import { colors, radius, spacing, typography } from '../../../src/theme';

interface DraftLine {
  key: string;
  description: string;
  quantity: string;
  qbProductCode: string;
}

/** Entier strictement positif, comme le contrat (pas de décimale). */
function parseQty(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  if (!Number.isSafeInteger(n) || n <= 0 || n > 1_000_000) return null;
  return n;
}

function dateFromYmd(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return startOfDay(new Date());
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export default function NewCustomerOrderScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { orderId: orderIdParam } = useLocalSearchParams<{ orderId?: string }>();
  const orderId = typeof orderIdParam === 'string' && orderIdParam ? orderIdParam : null;
  const editing = orderId != null;
  const allowed = editing
    ? canCustomerOrder('edit', user)
    : canCustomerOrder('create', user);
  const clientsQ = useQuery(() => clientsApi.list(), []);
  const existingQ = useQuery(
    () => (orderId ? customerOrders.get(orderId) : Promise.resolve(null)),
    [orderId],
  );
  const create = useMutation(customerOrders.create);
  const update = useMutation(customerOrders.update);
  const nextKey = useRef(1);
  const prefilled = useRef(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [orderDate, setOrderDate] = useState(() => startOfDay(new Date()));
  const [lines, setLines] = useState<DraftLine[]>([
    { key: 'l1', description: '', quantity: '1', qbProductCode: '' },
  ]);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (user && !allowed) router.replace('/(tabs)/customer-orders');
  }, [user, allowed, router]);

  useEffect(() => {
    const existing = existingQ.data;
    if (!existing || prefilled.current) return;
    prefilled.current = true;
    setClientId(existing.clientId);
    setOrderDate(dateFromYmd(existing.orderDate));
    setNotes(existing.notes ?? '');
    if (existing.lines.length === 0) return;
    nextKey.current = existing.lines.length;
    setLines(
      existing.lines.map((line) => ({
        key: `e${line.id}`,
        description: line.description,
        quantity: String(line.quantity),
        qbProductCode: line.qbProductCode ?? '',
      })),
    );
  }, [existingQ.data]);

  const clientOptions = useMemo(
    () =>
      (clientsQ.data ?? []).map((client) => ({
        id: String(client.id),
        label: client.name,
        sublabel: [client.city, client.address].filter(Boolean).join(' · ') || undefined,
      })),
    [clientsQ.data],
  );

  const selectedClientLabel =
    clientId == null
      ? null
      : (clientOptions.find((option) => option.id === clientId)?.label ?? `Client #${clientId}`);

  const isToday = toISODate(orderDate) === toISODate(new Date());

  const shiftDate = (days: number) => {
    setOrderDate((prev) => {
      const next = startOfDay(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  const updateLine = (key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const addLine = () => {
    nextKey.current += 1;
    setLines((prev) => [
      ...prev,
      { key: `l${nextKey.current}`, description: '', quantity: '1', qbProductCode: '' },
    ]);
  };

  const removeLine = (key: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
  };

  const buildLines = (): { ok: true; lines: CustomerOrderLineInput[] } | { ok: false; message: string } => {
    const touched = lines.filter(
      (line) => line.description.trim() || line.qbProductCode.trim(),
    );
    if (touched.length === 0) {
      return {
        ok: false,
        message: 'Ajoutez au moins une ligne avec une description et une quantité entière supérieure à 0.',
      };
    }
    const built: CustomerOrderLineInput[] = [];
    for (const line of touched) {
      const description = line.description.trim();
      const quantity = parseQty(line.quantity);
      if (!description || quantity == null) {
        return {
          ok: false,
          message: 'Chaque ligne doit avoir une description et une quantité entière supérieure à 0.',
        };
      }
      if (description.length > 500) {
        return { ok: false, message: 'La description dépasse 500 caractères.' };
      }
      const code = line.qbProductCode.trim();
      if (code.length > 50) {
        return { ok: false, message: 'Le code QuickBooks dépasse 50 caractères.' };
      }
      built.push({
        description,
        quantity,
        ...(code ? { qbProductCode: code } : {}),
      });
    }
    return { ok: true, lines: built };
  };

  const save = async () => {
    if (!clientId) {
      setFormError('Sélectionnez un client.');
      return;
    }
    const built = buildLines();
    if (!built.ok) {
      setFormError(built.message);
      return;
    }
    setFormError(null);
    if (notes.trim().length > 5000) {
      setFormError('Les notes dépassent 5000 caractères.');
      return;
    }
    try {
      const payload = {
        clientId,
        orderDate: toISODate(orderDate),
        notes: notes.trim() || null,
        lines: built.lines,
      };
      const result =
        editing && orderId
          ? await update.mutate({ id: orderId, ...payload })
          : await create.mutate(payload);
      router.replace(`/(tabs)/customer-orders/${result.id}`);
    } catch (e) {
      Alert.alert(
        'Enregistrement impossible',
        e instanceof Error ? e.message : 'Une erreur est survenue.',
      );
    }
  };

  if (!allowed) return null;
  if (editing && existingQ.loading && !existingQ.data) {
    return (
      <Screen edges={['left', 'right']}>
        <LoadingState label="Chargement de la commande…" />
      </Screen>
    );
  }
  if (editing && existingQ.error) {
    return (
      <Screen edges={['left', 'right']}>
        <ErrorState message={existingQ.error.message} onRetry={existingQ.refetch} />
      </Screen>
    );
  }

  const saving = create.loading || update.loading;

  return (
    <Screen edges={['left', 'right']} padded={false}>
      <Stack.Screen options={{ title: editing ? 'Modifier la commande' : 'Nouvelle commande' }} />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <SectionTitle>Client</SectionTitle>
        <Card style={styles.block}>
          <EntityPicker
            label="Client"
            required
            placeholder="Sélectionner un client"
            triggerIcon="business-outline"
            modalTitle="Choisir un client"
            searchPlaceholder="Rechercher un client…"
            emptyLabel={clientsQ.loading ? 'Chargement…' : 'Aucun client.'}
            value={clientId}
            displayLabel={selectedClientLabel}
            options={clientOptions}
            loading={clientsQ.loading}
            error={formError && !clientId ? formError : (clientsQ.error?.message ?? null)}
            onSelect={(option) => {
              setClientId(option ? option.id : null);
              if (option) setFormError(null);
            }}
          />

          <Text style={styles.fieldLabel}>Date</Text>
          <View style={styles.dateRow}>
            <Button
              title="◀"
              variant="secondary"
              fullWidth={false}
              onPress={() => shiftDate(-1)}
              style={styles.dateBtn}
            />
            <View style={styles.dateLabel}>
              <Text style={styles.dateText}>{formatOrderDate(orderDate)}</Text>
            </View>
            <Button
              title="▶"
              variant="secondary"
              fullWidth={false}
              onPress={() => shiftDate(1)}
              style={styles.dateBtn}
            />
          </View>
          {isToday ? null : (
            <Button
              title="Aujourd'hui"
              variant="ghost"
              fullWidth={false}
              onPress={() => setOrderDate(startOfDay(new Date()))}
              style={styles.todayBtn}
            />
          )}
        </Card>

        <SectionTitle>Ce dont le client a besoin</SectionTitle>
        <Card style={styles.block}>
          {lines.map((line, index) => (
            <View
              key={line.key}
              style={[styles.lineBlock, index === lines.length - 1 && styles.lineBlockLast]}
            >
              <View style={styles.lineRow}>
                <View style={styles.descField}>
                  <TextField
                    label="Description"
                    value={line.description}
                    onChangeText={(description) => updateLine(line.key, { description })}
                    placeholder="Ex. caméras dôme 4K"
                  />
                </View>
                <View style={styles.qtyField}>
                  <TextField
                    label="Qté"
                    value={line.quantity}
                    onChangeText={(quantity) =>
                      updateLine(line.key, { quantity: quantity.replace(/\D/g, '') })
                    }
                    keyboardType="number-pad"
                    inputMode="numeric"
                    placeholder="1"
                  />
                </View>
              </View>
              <TextField
                label="Code QuickBooks (optionnel)"
                value={line.qbProductCode}
                onChangeText={(qbProductCode) => updateLine(line.key, { qbProductCode })}
                placeholder="Optionnel"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {lines.length > 1 ? (
                <Pressable
                  onPress={() => removeLine(line.key)}
                  accessibilityRole="button"
                  style={styles.removeBtn}
                >
                  <Text style={styles.removeText}>Retirer</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable onPress={addLine} accessibilityRole="button" style={styles.addBtn}>
            <Text style={styles.addText}>+ Ajouter une ligne</Text>
          </Pressable>
        </Card>

        <SectionTitle>Notes</SectionTitle>
        <Card>
          <TextField
            label="Notes (optionnel)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Précisions, contraintes, rappel…"
            maxLength={5000}
            multiline
            style={styles.notes}
          />
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        {formError && clientId ? <Text style={styles.error}>{formError}</Text> : null}
        <View style={styles.actions}>
          <View style={styles.action}>
            <Button title="Annuler" variant="secondary" onPress={() => router.back()} />
          </View>
          <View style={styles.action}>
            <Button title="Enregistrer" onPress={() => void save()} loading={saving} />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.md },
  block: { marginBottom: spacing.lg },
  fieldLabel: {
    fontSize: typography.small,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateBtn: { minWidth: 52, paddingHorizontal: spacing.md },
  dateLabel: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: typography.body,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  todayBtn: { alignSelf: 'center', marginTop: spacing.xs },
  lineBlock: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  lineBlockLast: { borderBottomWidth: 0, marginBottom: 0 },
  lineRow: { flexDirection: 'row', gap: spacing.md },
  descField: { flex: 1 },
  qtyField: { width: 88 },
  removeBtn: { alignSelf: 'flex-end', marginTop: -spacing.sm, marginBottom: spacing.sm },
  removeText: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: typography.weightSemibold,
  },
  addBtn: { paddingVertical: spacing.sm },
  addText: {
    color: colors.navy,
    fontSize: typography.body,
    fontWeight: typography.weightSemibold,
  },
  notes: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  error: { color: colors.danger, fontSize: typography.small },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
});
