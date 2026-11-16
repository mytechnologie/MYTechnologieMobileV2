/**
 * Vue partagée (téléphone : route [id] ; iPad : panneau de droite).
 * Un seul écran, en liste de sections selon le type de bon. La barre du bas
 * montre l'enregistrement et ouvre la signature existante.
 */
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { AccessoryTextInput } from '../components/KeyboardAccessory';
import { Button, Card } from '../components/Primitives';
import { Screen } from '../components/Screen';
import { ErrorState, LoadingState } from '../components/States';
import { punch, SIGNATURE_CAPTION, workOrders } from '../api/endpoints';
import { useMutation, useQuery } from '../api/useApi';
import { useAuth } from '../auth/AuthContext';
import { isElevated } from '../auth/access';
import { formatDate, workOrderStatusStyle } from '../lib/format';
import { technicianMayEditWorkOrder, workOrderEditLockReason } from '../lib/workOrderEdit';
import type { InstallTest, WorkOrderContent, WorkOrderStatus } from '../api/types';
import { colors, radius, spacing, typography } from '../theme';

const AUTOSAVE_MS = 1500;

type ContentKey = keyof WorkOrderContent;

const ARRIVED = ['en_cours', 'complete', 'en_revision', 'a_facturer', 'facture', 'non_facture'];

const EMPTY_CONTENT: WorkOrderContent = {
  problemDescription: '',
  actionsTaken: '',
  installRequest: '',
  installDescription: '',
  materialsInternal: '',
  followUp: '',
  clientNote: '',
};

function diffContent(draft: Partial<WorkOrderContent>, base: WorkOrderContent): Partial<WorkOrderContent> {
  const out: Partial<WorkOrderContent> = {};
  (Object.keys(draft) as ContentKey[]).forEach((key) => {
    if ((draft[key] ?? '') !== (base[key] ?? '')) out[key] = draft[key] ?? '';
  });
  return out;
}

function sameTests(a: InstallTest[], b: InstallTest[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((test, index) => test.label === b[index]?.label && test.checked === b[index]?.checked);
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
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
  const punchQ = useQuery(() => punch.status().catch(() => null), [workOrderId]);
  const changeStatus = useMutation(workOrders.changeStatus);

  const [draft, setDraft] = useState<Partial<WorkOrderContent>>({});
  const [testsDraft, setTestsDraft] = useState<InstallTest[] | null>(null);
  const [committed, setCommitted] = useState<WorkOrderContent | null>(null);
  const [committedTests, setCommittedTests] = useState<InstallTest[] | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [newTest, setNewTest] = useState('');
  const [uploading, setUploading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [seenId, setSeenId] = useState(workOrderId);
  if (seenId !== workOrderId) {
    setSeenId(workOrderId);
    setDraft({});
    setTestsDraft(null);
    setCommitted(null);
    setCommittedTests(null);
    setSaveStatus('idle');
    setSaveError(null);
    setNewTest('');
  }

  const wo = woQ.data;
  const canEdit = wo
    ? technicianMayEditWorkOrder({
        role: user?.role,
        elevated: admin,
        status: wo.status,
        dispatchedAt: wo.dispatchedAt,
      })
    : false;
  const lockReason = wo
    ? workOrderEditLockReason({
        role: user?.role,
        elevated: admin,
        status: wo.status,
        dispatchedAt: wo.dispatchedAt,
      })
    : null;
  const baseContent = committed ?? wo?.content ?? EMPTY_CONTENT;
  const baseTests = committedTests ?? wo?.tests ?? [];
  const tests = testsDraft ?? baseTests;
  const changed = diffContent(draft, baseContent);
  const testsDirty = testsDraft != null && !sameTests(testsDraft, baseTests);
  const dirty = Object.keys(changed).length > 0 || testsDirty;

  const dirtyRef = useRef(dirty);
  const saveStatusRef = useRef(saveStatus);
  const draftRef = useRef(draft);
  const testsDraftRef = useRef(testsDraft);
  const committedRef = useRef(committed);
  const committedTestsRef = useRef(committedTests);
  const woRef = useRef(wo);
  const canEditRef = useRef(canEdit);
  const discardRef = useRef(false);
  const mountedRef = useRef(true);
  const inflightRef = useRef<Promise<boolean> | null>(null);
  const saveRef = useRef<() => Promise<boolean>>(async () => true);

  const clockedHere =
    !!punchQ.data?.isClockedIn && punchQ.data.workOrderId === workOrderId && !!punchQ.data.since;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!embedded && wo?.number) navigation.setOptions({ title: wo.number });
  }, [embedded, navigation, wo?.number]);

  useEffect(() => {
    if (!clockedHere) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [clockedHere]);

  const persist = async (): Promise<boolean> => {
    if (!canEditRef.current) return true;
    const current = woRef.current;
    const base = committedRef.current ?? current?.content;
    if (!current || !base) return true;
    const nextChanged = diffContent(draftRef.current, base);
    const nextTests = testsDraftRef.current;
    const testsBase = committedTestsRef.current ?? current.tests;
    const testsNeed = nextTests != null && !sameTests(nextTests, testsBase);
    if (Object.keys(nextChanged).length === 0 && !testsNeed) {
      if (mountedRef.current) {
        setSaveStatus('saved');
        setSaveError(null);
      }
      return true;
    }
    if (mountedRef.current) {
      setSaveStatus('saving');
      setSaveError(null);
    }
    try {
      await workOrders.saveContent(workOrderId, nextChanged, testsNeed ? nextTests ?? undefined : undefined);
      if (!mountedRef.current) return true;
      setCommitted({ ...base, ...nextChanged });
      setDraft((prev) => {
        const next = { ...prev };
        (Object.keys(nextChanged) as ContentKey[]).forEach((key) => {
          if (next[key] === nextChanged[key]) delete next[key];
        });
        return next;
      });
      if (testsNeed && nextTests) {
        setCommittedTests(nextTests);
        setTestsDraft((prev) => (prev && sameTests(prev, nextTests) ? null : prev));
      }
      setSaveStatus('saved');
      return true;
    } catch (e) {
      if (!mountedRef.current) return false;
      setSaveError(e instanceof Error ? e.message : 'Enregistrement impossible.');
      setSaveStatus('error');
      return false;
    }
  };

  useEffect(() => {
    dirtyRef.current = dirty;
    saveStatusRef.current = saveStatus;
    draftRef.current = draft;
    testsDraftRef.current = testsDraft;
    committedRef.current = committed;
    committedTestsRef.current = committedTests;
    woRef.current = wo;
    canEditRef.current = canEdit;
    saveRef.current = () => {
      if (inflightRef.current) return inflightRef.current.then(() => saveRef.current());
      const run = persist().finally(() => {
        inflightRef.current = null;
      });
      inflightRef.current = run;
      return run;
    };
  });

  useEffect(() => {
    if (!dirty || !canEdit) return;
    const timer = setTimeout(() => {
      void saveRef.current();
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [dirty, canEdit, draft, testsDraft]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (discardRef.current) return;
      if (!dirtyRef.current && saveStatusRef.current !== 'error') return;
      e.preventDefault();
      Alert.alert(
        'Modifications non enregistrées',
        saveStatusRef.current === 'error'
          ? "L'enregistrement a échoué. Vous pouvez réessayer, ou quitter sans enregistrer."
          : 'Des changements ne sont pas encore enregistrés.',
        [
          { text: 'Rester', style: 'cancel' },
          {
            text: 'Quitter sans enregistrer',
            style: 'destructive',
            onPress: () => {
              discardRef.current = true;
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Enregistrer',
            onPress: () => {
              void saveRef.current().then((ok) => {
                if (!ok) return;
                discardRef.current = true;
                navigation.dispatch(e.data.action);
              });
            },
          },
        ],
      );
    });
    return unsub;
  }, [navigation]);

  // saveRef est mis à jour dans un effet : au changement de bon, ce nettoyage
  // appelle encore l'enregistrement du bon qu'on quitte.
  useEffect(() => {
    return () => {
      if (!discardRef.current) void saveRef.current();
    };
  }, [workOrderId]);

  useFocusEffect(
    useCallback(() => {
      woQ.refetch();
      photosQ.refetch();
      punchQ.refetch();
      return () => {
        if (!discardRef.current) void saveRef.current();
      };
      // Les refetch sont stables pour cet écran ; on ne les met pas en dépendance.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workOrderId]),
  );

  if (woQ.loading && !wo) return <LoadingState label="Chargement du bon…" />;
  if (woQ.error || !wo) {
    return <ErrorState message={woQ.error?.message} onRetry={woQ.refetch} />;
  }

  const badge = workOrderStatusStyle(wo.status);
  const client = clientQ.data;
  const phone = client?.contactPhone || client?.phone || null;
  const address = wo.address || client?.address || null;
  const photos = (photosQ.data ?? []).filter((photo) => photo.caption !== SIGNATURE_CAPTION);
  const signed = (photosQ.data ?? []).some((photo) => photo.caption === SIGNATURE_CAPTION);
  const isInstall = wo.docType === 'bon_installation';
  const valueOf = (key: ContentKey) => draft[key] ?? baseContent[key] ?? '';
  const arrived = ARRIVED.includes(wo.status);
  const mainText = isInstall ? valueOf('installDescription') : valueOf('actionsTaken');

  const setField = (key: ContentKey, text: string) => {
    if (!canEdit) return;
    setDraft((prev) => ({ ...prev, [key]: text }));
  };

  const advance = async (to: WorkOrderStatus) => {
    try {
      await changeStatus.mutate({ id: workOrderId, status: to });
      woQ.refetch();
    } catch (e) {
      Alert.alert('Statut', e instanceof Error ? e.message : 'Changement de statut impossible.');
    }
  };

  const toggleTest = (index: number) => {
    if (!canEdit) return;
    setTestsDraft(tests.map((test, i) => (i === index ? { ...test, checked: !test.checked } : test)));
  };
  const removeTest = (index: number) => {
    if (!canEdit) return;
    setTestsDraft(tests.filter((_, i) => i !== index));
  };
  const addTest = () => {
    if (!canEdit) return;
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

  const missing: string[] = [];
  if (wo.status === 'en_cours') {
    if (!mainText.trim()) {
      missing.push(isInstall ? "description de l'installation" : 'travail effectué');
    }
    if (photos.length === 0) missing.push('une photo');
  }
  let hint: string | null = null;
  if (lockReason) hint = lockReason;
  else if (wo.status !== 'en_cours') {
    hint = arrived ? 'Bon déjà terminé.' : 'Il manque : arrivée sur place.';
  } else if (missing.length > 0) {
    hint = `Il manque : ${missing.join(', ')}.`;
  }
  const finishDisabled = hint != null;

  const finish = async () => {
    if (finishDisabled) return;
    const ok = await saveRef.current();
    if (!ok) return;
    router.push({ pathname: '/(tabs)/work-orders/signature', params: { id: workOrderId } });
  };

  const blurSave = () => {
    void saveRef.current();
  };

  const saveLabel =
    saveStatus === 'saving' || (dirty && saveStatus !== 'error')
      ? 'Enregistrement…'
      : saveStatus === 'error'
        ? saveError ?? 'Enregistrement impossible.'
        : '✓ Enregistré';

  return (
    <Screen
      scroll
      edges={['left', 'right']}
      refreshing={woQ.refreshing}
      onRefresh={() => {
        if (!dirtyRef.current) {
          setCommitted(null);
          setCommittedTests(null);
        }
        woQ.refetch();
        photosQ.refetch();
        punchQ.refetch();
      }}
      footer={
        <View style={styles.footer}>
          <View style={styles.saveRow}>
            <Text
              style={[
                styles.saveText,
                saveStatus === 'error' && styles.saveError,
                saveStatus !== 'error' && !dirty && styles.saveOk,
              ]}
              numberOfLines={2}
            >
              {saveLabel}
            </Text>
            {saveStatus === 'error' ? (
              <Pressable onPress={() => void saveRef.current()} hitSlop={8} accessibilityRole="button">
                <Text style={styles.retry}>Réessayer</Text>
              </Pressable>
            ) : null}
          </View>
          <Button
            title="Terminer · signature"
            variant="gold"
            disabled={finishDisabled}
            onPress={() => void finish()}
          />
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        </View>
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroKicker}>
            {isInstall ? "Bon d'installation" : 'Bon de travail'} · {wo.number}
          </Text>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{badge.label}</Text>
          </View>
        </View>
        <Text style={styles.heroTitle}>{wo.title}</Text>
        <Text style={styles.heroSub}>{wo.client ?? client?.name ?? 'Client'}</Text>
        {wo.scheduledDate ? <Text style={styles.heroMeta}>Prévu le {formatDate(wo.scheduledDate)}</Text> : null}
        {address ? <Text style={styles.heroMeta}>{address}</Text> : null}
        {client?.contactName ? <Text style={styles.heroMeta}>Contact : {client.contactName}</Text> : null}
        <View style={styles.heroActions}>
          <Button
            title="Appeler"
            variant="secondary"
            fullWidth={false}
            style={styles.heroBtn}
            onPress={() => (phone ? openPhone(phone) : Alert.alert('Appeler', 'Aucun numéro au dossier du client.'))}
          />
          <Button
            title="Itinéraire"
            variant="secondary"
            fullWidth={false}
            style={styles.heroBtn}
            onPress={() => (address ? openMaps(address) : Alert.alert('Itinéraire', 'Aucune adresse au bon.'))}
          />
        </View>
      </View>

      {lockReason ? <Text style={styles.locked}>{lockReason}</Text> : null}

      <SectionCard
        title="Arrivée"
        filled={arrived}
        iconColor={arrived ? colors.success : colors.terrain}
      >
        <Text style={styles.body}>{badge.label}</Text>
        {wo.status === 'planifie' ? (
          <Button
            title="Je pars (en route)"
            loading={changeStatus.loading}
            onPress={() => void advance('en_route')}
          />
        ) : null}
        {wo.status === 'en_route' ? (
          <Button
            title="Je suis arrivé (sur place)"
            loading={changeStatus.loading}
            onPress={() => void advance('en_cours')}
          />
        ) : null}
        {clockedHere && punchQ.data?.since ? (
          <Text style={styles.timer}>En service · {formatElapsed(now - punchQ.data.since.getTime())}</Text>
        ) : null}
      </SectionCard>

      {isInstall ? (
        <SectionCard title="Demande" filled={!!valueOf('installRequest').trim()}>
          <Field
            value={valueOf('installRequest')}
            placeholder="Ce que le client a demandé…"
            editable={canEdit}
            onChangeText={(text) => setField('installRequest', text)}
            onBlur={blurSave}
          />
        </SectionCard>
      ) : (
        <SectionCard title="Problème" filled={!!valueOf('problemDescription').trim()}>
          <Field
            value={valueOf('problemDescription')}
            placeholder="Le problème signalé…"
            editable={canEdit}
            onChangeText={(text) => setField('problemDescription', text)}
            onBlur={blurSave}
          />
        </SectionCard>
      )}

      {isInstall ? (
        <SectionCard title="Installation" filled={!!mainText.trim()} required={!mainText.trim()}>
          <Field
            value={valueOf('installDescription')}
            placeholder="Ce qui a été installé…"
            editable={canEdit}
            onChangeText={(text) => setField('installDescription', text)}
            onBlur={blurSave}
          />
        </SectionCard>
      ) : (
        <SectionCard title="Travail effectué" filled={!!mainText.trim()} required={!mainText.trim()}>
          <Field
            value={valueOf('actionsTaken')}
            placeholder="Ce qui a été fait…"
            editable={canEdit}
            onChangeText={(text) => setField('actionsTaken', text)}
            onBlur={blurSave}
          />
        </SectionCard>
      )}

      {isInstall ? (
        <SectionCard
          title="Tests"
          filled={tests.length > 0 && tests.every((test) => test.checked)}
        >
          <Text style={styles.meta}>
            {tests.filter((test) => test.checked).length}/{tests.length} cochés
          </Text>
          {tests.map((test, index) => (
            <View key={`${index}-${test.label}`} style={styles.testRow}>
              <Pressable
                style={styles.testCheck}
                onPress={() => toggleTest(index)}
                disabled={!canEdit}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: test.checked }}
                accessibilityLabel={test.label}
              >
                <Ionicons
                  name={test.checked ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={test.checked ? colors.success : colors.textMuted}
                />
                <Text style={styles.body}>{test.label}</Text>
              </Pressable>
              {canEdit ? (
                <Pressable onPress={() => removeTest(index)} hitSlop={8} accessibilityLabel={`Retirer ${test.label}`}>
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          ))}
          {canEdit ? (
            <View style={styles.testRow}>
              <AccessoryTextInput
                style={[styles.notes, styles.testInput]}
                placeholder="Ajouter un test…"
                placeholderTextColor={colors.disabled}
                value={newTest}
                onChangeText={setNewTest}
                onSubmitEditing={addTest}
                onBlur={blurSave}
                returnKeyType="done"
              />
              <Pressable onPress={addTest} hitSlop={8} accessibilityLabel="Ajouter le test">
                <Ionicons name="add-circle" size={28} color={colors.navy} />
              </Pressable>
            </View>
          ) : null}
        </SectionCard>
      ) : (
        <SectionCard title="Matériaux" filled={!!valueOf('materialsInternal').trim()}>
          <Text style={styles.internal}>Interne</Text>
          <Field
            value={valueOf('materialsInternal')}
            placeholder="Pièces, quantités…"
            editable={canEdit}
            onChangeText={(text) => setField('materialsInternal', text)}
            onBlur={blurSave}
          />
        </SectionCard>
      )}

      <SectionCard title="Photos" filled={photos.length > 0} required={photos.length === 0}>
        <View style={styles.grid}>
          {photos.map((photo) => (
            <View key={photo.id}>
              <Image source={{ uri: photo.url }} style={styles.thumb} accessibilityLabel={photo.caption ?? 'Photo du bon'} />
              {admin ? (
                <Pressable
                  style={styles.thumbDelete}
                  onPress={() => deletePhoto(photo.id)}
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
            onPress={() => void takePhoto()}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="Prendre une photo"
          >
            <Ionicons name={uploading ? 'cloud-upload-outline' : 'camera-outline'} size={26} color={colors.navy} />
          </Pressable>
        </View>
      </SectionCard>

      <SectionCard title="Signature" filled={signed} required={!signed}>
        <Text style={styles.body}>
          {signed
            ? 'Signature du client enregistrée.'
            : 'La signature se prend à la fin, avec le bouton du bas.'}
        </Text>
      </SectionCard>

      {admin ? (
        <SectionCard title="Bureau" filled={!!valueOf('followUp').trim() || !!valueOf('clientNote').trim()}>
          <Text style={styles.meta}>{"Visible seulement pour l'administration."}</Text>
          <Text style={styles.fieldLabel}>Suivi requis / notes</Text>
          <Field
            value={valueOf('followUp')}
            placeholder="Un suivi est-il nécessaire ?"
            editable={canEdit}
            onChangeText={(text) => setField('followUp', text)}
            onBlur={blurSave}
          />
          <Text style={styles.fieldLabel}>Note pour le client (PDF)</Text>
          <Field
            value={valueOf('clientNote')}
            placeholder="Message imprimé sur le PDF du client…"
            editable={canEdit}
            onChangeText={(text) => setField('clientNote', text)}
            onBlur={blurSave}
          />
        </SectionCard>
      ) : null}
    </Screen>
  );
}

function SectionCard({
  title,
  filled,
  required = false,
  iconColor,
  children,
}: {
  title: string;
  filled: boolean;
  required?: boolean;
  iconColor?: string;
  children: ReactNode;
}) {
  const missing = required && !filled;
  return (
    <Card style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons
          name={filled ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={iconColor ?? (filled ? colors.success : colors.disabled)}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
        {missing ? (
          <View style={styles.requis}>
            <Text style={styles.requisText}>Requis</Text>
          </View>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

function Field({
  value,
  placeholder,
  editable,
  onChangeText,
  onBlur,
}: {
  value: string;
  placeholder: string;
  editable: boolean;
  onChangeText: (text: string) => void;
  onBlur: () => void;
}) {
  return (
    <AccessoryTextInput
      style={[styles.notes, !editable && styles.notesLocked]}
      multiline
      placeholder={placeholder}
      placeholderTextColor={colors.disabled}
      value={value}
      editable={editable}
      onChangeText={onChangeText}
      onBlur={onBlur}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heroKicker: {
    flex: 1,
    color: colors.textOnNavy,
    opacity: 0.85,
    fontSize: typography.tiny,
    fontWeight: typography.weightSemibold,
  },
  heroBadge: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  heroBadgeText: { color: colors.navy, fontSize: typography.tiny, fontWeight: typography.weightBold },
  heroTitle: { color: colors.textOnNavy, fontSize: typography.h3, fontWeight: typography.weightBold },
  heroSub: { color: colors.textOnNavy, fontSize: typography.body, fontWeight: typography.weightMedium },
  heroMeta: { color: colors.textOnNavy, opacity: 0.85, fontSize: typography.small },
  heroActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  heroBtn: { flex: 1 },
  locked: {
    color: colors.textMuted,
    fontSize: typography.small,
    marginBottom: spacing.md,
  },
  section: { marginBottom: spacing.md, gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { flex: 1, fontSize: typography.body, fontWeight: typography.weightBold, color: colors.text },
  requis: {
    backgroundColor: colors.warningBg,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  requisText: { color: colors.warning, fontSize: typography.tiny, fontWeight: typography.weightBold },
  body: { fontSize: typography.body, color: colors.text, lineHeight: 22 },
  meta: { fontSize: typography.small, color: colors.textMuted },
  timer: { fontSize: typography.body, fontWeight: typography.weightSemibold, color: colors.terrain },
  internal: {
    alignSelf: 'flex-start',
    fontSize: typography.tiny,
    color: colors.textMuted,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  fieldLabel: { fontSize: typography.small, fontWeight: typography.weightSemibold, color: colors.text },
  notes: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.body,
    color: colors.text,
    textAlignVertical: 'top',
    backgroundColor: colors.surface,
  },
  notesLocked: { backgroundColor: colors.surfaceAlt, color: colors.textMuted },
  testRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  testCheck: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  testInput: { flex: 1, minHeight: 44 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  addThumb: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  saveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  saveText: { flex: 1, fontSize: typography.small, color: colors.textMuted },
  saveOk: { color: colors.success, fontWeight: typography.weightSemibold },
  saveError: { color: colors.danger },
  retry: { color: colors.navy, fontSize: typography.small, fontWeight: typography.weightBold },
  hint: { textAlign: 'center', color: colors.textMuted, fontSize: typography.small },
});
