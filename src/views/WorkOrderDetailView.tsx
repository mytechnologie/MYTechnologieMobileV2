/**
 * Vue partagée (téléphone : route [id] ; iPad : panneau de droite).
 * Bon de travail sur place (maquette écran 3) : étapes du parcours terrain,
 * appeler / itinéraire, photos, contenu du bon (mêmes champs que le
 * formulaire du portail, selon le type de bon et le rôle) et fin du bon avec
 * la signature du client.
 */
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card } from '../components/Primitives';
import { Screen } from '../components/Screen';
import { ErrorState, LoadingState } from '../components/States';
import { SIGNATURE_CAPTION, workOrders } from '../api/endpoints';
import { useMutation, useQuery } from '../api/useApi';
import { useAuth } from '../auth/AuthContext';
import { isElevated } from '../auth/access';
import { formatDate, workOrderStatusStyle } from '../lib/format';
import type { InstallTest, WorkOrderContent, WorkOrderStatus } from '../api/types';
import { colors, radius, spacing, typography } from '../theme';

/** Parcours terrain affiché en étapes. */
const STEPS: { status: WorkOrderStatus; label: string }[] = [
  { status: 'en_route', label: 'En route' },
  { status: 'en_cours', label: 'Sur place' },
  { status: 'complete', label: 'Terminé' },
];

/** Prochaine étape proposée selon le statut actuel (null : rien à faire ici). */
function nextStep(status: string): { status: WorkOrderStatus; label: string } | null {
  if (status === 'nouveau' || status === 'a_rappeler' || status === 'planifie') {
    return { status: 'en_route', label: 'Je pars (en route)' };
  }
  if (status === 'en_route') return { status: 'en_cours', label: 'Je suis arrivé (sur place)' };
  return null;
}

function stepIndex(status: string): number {
  if (status === 'en_route') return 0;
  if (status === 'en_cours') return 1;
  if (['complete', 'en_revision', 'a_facturer', 'facture', 'non_facture'].includes(status)) return 2;
  return -1;
}

type ContentKey = keyof WorkOrderContent;

interface FieldDef {
  key: ContentKey;
  label: string;
  placeholder: string;
  /** Badge « Interne » : jamais sur le PDF client. */
  internal?: boolean;
}

/** Champs du formulaire du portail (WorkOrderEdit), dans le même ordre. */
function fieldsFor(isInstall: boolean, admin: boolean): FieldDef[] {
  const main: FieldDef[] = isInstall
    ? [
        { key: 'installRequest', label: "Demande d'installation", placeholder: 'Ce que le client a demandé…' },
        { key: 'installDescription', label: "Description de l'installation", placeholder: 'Ce qui a été installé…' },
      ]
    : [
        { key: 'problemDescription', label: 'Problème / travaux demandés', placeholder: 'Le problème signalé…' },
        { key: 'actionsTaken', label: 'Actions effectuées', placeholder: 'Ce qui a été fait…' },
      ];
  const rest: FieldDef[] = [
    { key: 'materialsInternal', label: 'Matériaux / pièces utilisés', placeholder: 'Pièces, quantités…', internal: true },
  ];
  if (admin) {
    rest.push(
      { key: 'followUp', label: 'Suivi requis / notes', placeholder: 'Un suivi est-il nécessaire ?' },
      { key: 'clientNote', label: 'Note pour le client (PDF)', placeholder: 'Message imprimé sur le PDF du client…' },
    );
  }
  return [...main, ...rest];
}

function openPhone(phone: string) {
  void Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`);
}

function openMaps(address: string) {
  const q = encodeURIComponent(address);
  const url = Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${q}` : `geo:0,0?q=${q}`;
  void Linking.openURL(url);
}

export function WorkOrderDetailView({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const navigation = useNavigation();
  const router = useRouter();
  const { user } = useAuth();
  const admin = !!user && isElevated(user);
  const workOrderId = String(id);

  const woQ = useQuery(() => workOrders.getById(workOrderId), [workOrderId]);
  const clientId = woQ.data?.clientId ?? null;
  const clientQ = useQuery(
    () => (clientId ? workOrders.client(clientId).catch(() => null) : Promise.resolve(null)),
    [clientId],
  );
  const photosQ = useQuery(() => workOrders.photos(workOrderId).catch(() => []), [workOrderId]);
  const changeStatus = useMutation(workOrders.changeStatus);

  const [draft, setDraft] = useState<Partial<WorkOrderContent>>({});
  const [testsDraft, setTestsDraft] = useState<InstallTest[] | null>(null);
  const [newTest, setNewTest] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!embedded && woQ.data?.number) navigation.setOptions({ title: woQ.data.number });
  }, [embedded, navigation, woQ.data?.number]);

  // Retour de l'écran de signature : statut et photos à jour.
  useFocusEffect(
    useCallback(() => {
      woQ.refetch();
      photosQ.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (woQ.loading) return <LoadingState label="Chargement du bon…" />;
  if (woQ.error || !woQ.data) {
    return <ErrorState message={woQ.error?.message} onRetry={woQ.refetch} />;
  }

  const wo = woQ.data;
  const badge = workOrderStatusStyle(wo.status);
  const current = stepIndex(wo.status);
  const next = nextStep(wo.status);
  const canFinish = wo.status === 'en_cours';
  const client = clientQ.data;
  const phone = client?.contactPhone || client?.phone || null;
  const address = wo.address || client?.address || null;
  const photos = (photosQ.data ?? []).filter(p => p.caption !== SIGNATURE_CAPTION);
  const signed = (photosQ.data ?? []).some(p => p.caption === SIGNATURE_CAPTION);
  const isInstall = wo.docType === 'bon_installation';
  const fields = fieldsFor(isInstall, admin);
  const valueOf = (k: ContentKey) => draft[k] ?? wo.content[k];
  const changed = Object.fromEntries(
    (Object.keys(draft) as ContentKey[])
      .filter(k => draft[k] !== wo.content[k])
      .map(k => [k, draft[k]]),
  ) as Partial<WorkOrderContent>;
  const tests = testsDraft ?? wo.tests;
  const dirty = Object.keys(changed).length > 0 || testsDraft !== null;

  const advance = async (to: WorkOrderStatus) => {
    try {
      await changeStatus.mutate({ id: workOrderId, status: to });
      woQ.refetch();
    } catch (e) {
      Alert.alert('Statut', e instanceof Error ? e.message : 'Changement de statut impossible.');
    }
  };

  const save = async (): Promise<boolean> => {
    setSaving(true);
    try {
      await workOrders.saveContent(workOrderId, changed, testsDraft ?? undefined);
      setDraft({});
      setTestsDraft(null);
      woQ.refetch();
      return true;
    } catch (e) {
      Alert.alert('Bon de travail', e instanceof Error ? e.message : 'Enregistrement impossible.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleTest = (i: number) =>
    setTestsDraft(tests.map((t, j) => (j === i ? { ...t, checked: !t.checked } : t)));
  const removeTest = (i: number) => setTestsDraft(tests.filter((_, j) => j !== i));
  const addTest = () => {
    const label = newTest.trim();
    if (!label) return;
    setTestsDraft([...tests, { label, checked: false }]);
    setNewTest('');
  };

  const deletePhoto = (photoId: string) => {
    Alert.alert('Supprimer la photo', 'La photo sera retirée du bon. Continuer ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await workOrders.deletePhoto(photoId);
            photosQ.refetch();
          } catch (e) {
            Alert.alert('Photo', e instanceof Error ? e.message : 'Suppression impossible.');
          }
        },
      },
    ]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Appareil photo', "Autorisez l'appareil photo dans les réglages du téléphone.");
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    const asset = shot.canceled ? null : shot.assets[0];
    if (!asset) return;
    setUploading(true);
    try {
      await workOrders.addPhoto(workOrderId, asset.uri);
      photosQ.refetch();
    } catch (e) {
      Alert.alert('Photo', e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setUploading(false);
    }
  };

  const finish = async () => {
    // Le contenu non enregistré part avant la signature.
    if (dirty && !(await save())) return;
    router.push({ pathname: '/(tabs)/work-orders/signature', params: { id: workOrderId } });
  };

  return (
    <Screen scroll refreshing={woQ.refreshing} onRefresh={() => { woQ.refetch(); photosQ.refetch(); }}>
      <Card style={styles.block}>
        <View style={styles.rowBetween}>
          <Text style={styles.kicker}>{wo.client ?? client?.name ?? 'Client'}</Text>
          <Badge label={badge.label} color={badge.color} bg={badge.bg} />
        </View>
        <Text style={styles.title}>{wo.title}</Text>
        {wo.scheduledDate ? <Text style={styles.meta}>Prévu le {formatDate(wo.scheduledDate)}</Text> : null}

        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={s.status} style={styles.step}>
              <View
                style={[
                  styles.dot,
                  i < current && styles.dotDone,
                  i === current && (i === 2 ? styles.dotDone : styles.dotCurrent),
                ]}
              >
                {i < current || (i === 2 && current === 2) ? (
                  <Ionicons name="checkmark" size={16} color={colors.textOnNavy} />
                ) : null}
              </View>
              <Text style={[styles.stepLabel, i === current && styles.stepLabelCurrent]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {next ? (
          <Button
            title={next.label}
            variant="primary"
            loading={changeStatus.loading}
            onPress={() => advance(next.status)}
          />
        ) : null}
      </Card>

      <Card style={styles.block}>
        {client?.contactName ? <Text style={styles.body}>Contact : {client.contactName}</Text> : null}
        {address ? <Text style={styles.body}>{address}</Text> : null}
        <View style={styles.actions}>
          <Button
            title="Appeler"
            variant="secondary"
            fullWidth={false}
            style={styles.action}
            onPress={() => (phone ? openPhone(phone) : Alert.alert('Appeler', 'Aucun numéro au dossier du client.'))}
          />
          <Button
            title="Itinéraire"
            variant="secondary"
            fullWidth={false}
            style={styles.action}
            onPress={() => (address ? openMaps(address) : Alert.alert('Itinéraire', 'Aucune adresse au bon.'))}
          />
        </View>
      </Card>

      <Card style={styles.block}>
        <Text style={styles.section}>PHOTOS ({photos.length})</Text>
        <View style={styles.grid}>
          {photos.map(p => (
            <View key={p.id}>
              <Image source={{ uri: p.url }} style={styles.thumb} accessibilityLabel={p.caption ?? 'Photo du bon'} />
              {admin ? (
                <Pressable
                  style={styles.thumbDelete}
                  onPress={() => deletePhoto(p.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Supprimer la photo"
                >
                  <Ionicons name="close" size={14} color={colors.textOnNavy} />
                </Pressable>
              ) : null}
            </View>
          ))}
          <Pressable
            style={[styles.thumb, styles.addThumb]}
            onPress={takePhoto}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Prendre une photo"
          >
            <Ionicons name={uploading ? 'cloud-upload-outline' : 'camera-outline'} size={26} color={colors.navy} />
          </Pressable>
        </View>
      </Card>

      <Card style={styles.block}>
        {fields.map(f => (
          <View key={f.key} style={styles.field}>
            <View style={styles.rowBetween}>
              <Text style={styles.section}>{f.label.toUpperCase()}</Text>
              {f.internal ? <Text style={styles.internal}>Interne</Text> : null}
            </View>
            <TextInput
              style={styles.notes}
              multiline
              placeholder={f.placeholder}
              placeholderTextColor={colors.disabled}
              value={valueOf(f.key)}
              onChangeText={text => setDraft(d => ({ ...d, [f.key]: text }))}
            />
          </View>
        ))}

        {isInstall ? (
          <View style={styles.field}>
            <Text style={styles.section}>
              TESTS EFFECTUÉS ({tests.filter(t => t.checked).length}/{tests.length})
            </Text>
            {tests.map((t, i) => (
              <View key={`${i}-${t.label}`} style={styles.testRow}>
                <Pressable
                  style={styles.testCheck}
                  onPress={() => toggleTest(i)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: t.checked }}
                  accessibilityLabel={t.label}
                >
                  <Ionicons
                    name={t.checked ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={t.checked ? colors.success : colors.textMuted}
                  />
                  <Text style={styles.body}>{t.label}</Text>
                </Pressable>
                <Pressable onPress={() => removeTest(i)} hitSlop={8} accessibilityLabel={`Retirer ${t.label}`}>
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
            <View style={styles.testRow}>
              <TextInput
                style={[styles.notes, styles.testInput]}
                placeholder="Ajouter un test…"
                placeholderTextColor={colors.disabled}
                value={newTest}
                onChangeText={setNewTest}
                onSubmitEditing={addTest}
                returnKeyType="done"
              />
              <Pressable onPress={addTest} hitSlop={8} accessibilityLabel="Ajouter le test">
                <Ionicons name="add-circle" size={28} color={colors.navy} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {dirty ? (
          <Button title="Enregistrer le bon" variant="primary" loading={saving} onPress={() => void save()} />
        ) : null}
      </Card>

      {canFinish ? (
        <Button title="Terminer · signature du client" variant="gold" onPress={finish} style={styles.finish} />
      ) : null}
      {signed ? <Text style={styles.signed}>Signature du client enregistrée.</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.md, gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { fontSize: typography.small, color: colors.textMuted, fontWeight: typography.weightSemibold, flex: 1 },
  title: { fontSize: typography.h3, fontWeight: typography.weightBold, color: colors.text },
  meta: { fontSize: typography.small, color: colors.textMuted },
  steps: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.sm },
  step: { flex: 1, alignItems: 'center', gap: spacing.xs },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.success },
  dotCurrent: { backgroundColor: colors.gold },
  stepLabel: { fontSize: typography.tiny, color: colors.textMuted },
  stepLabelCurrent: { color: colors.text, fontWeight: typography.weightBold },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  section: { fontSize: typography.tiny, fontWeight: typography.weightBold, color: colors.textMuted },
  body: { fontSize: typography.body, color: colors.text, lineHeight: 22 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  addThumb: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: spacing.xs },
  internal: {
    fontSize: typography.tiny,
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  testRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  testCheck: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  testInput: { flex: 1, minHeight: 44 },
  thumbDelete: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notes: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.body,
    color: colors.text,
    textAlignVertical: 'top',
  },
  finish: { marginTop: spacing.sm, marginBottom: spacing.md },
  signed: { textAlign: 'center', color: colors.success, fontSize: typography.small, marginBottom: spacing.lg },
});
