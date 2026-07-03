/**
 * Annotateur de plan de chantier (cœur iPad). Réutilise les endpoints EXISTANTS
 * (projects.getPlans / updatePlanAnnotations) et le MÊME format JSON que le web
 * → les marqueurs sont partagés web ↔ iPad.
 *
 * - Zoom/pan : ScrollView natif (pinch-to-zoom iOS), sans reanimated.
 * - Marqueurs en coordonnées RELATIVES (x/y en % 0..100, 1 décimale) → corrects
 *   quel que soit le zoom / la taille d'écran.
 * - Types : caméra SURVEILLANCE (CCTV), accès, alarme, AP, porte, note, élec.
 * - Sauvegarde à chaque ajout/édition/suppression via updatePlanAnnotations.
 * - Export du plan annoté (image) via react-native-view-shot (import paresseux).
 *
 * PDF : rendu in-app (react-native-pdf, import paresseux) en VISUALISATION. Le
 * placement de marqueurs est actif sur les plans IMAGE ; pour les PDF il faudra
 * rasteriser la page (prochaine étape) — signalé dans l'UI.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { ErrorState, LoadingState } from '../components/States';
import { projects } from '../api/endpoints';
import { useQuery } from '../api/useApi';
import {
  ANNOTATION_STATUS,
  ANNOTATION_TYPES,
  ANNOTATION_TYPE_KEYS,
  NOTE_STATUS,
  annotationStatusColor,
} from '../lib/annotations';
import type { PlanAnnotation } from '../api/types';
import { colors, radius, spacing, typography } from '../theme';

/** id marqueur au même format que le web : a_<timestamp>_<rand>. */
function makeId(): string {
  return `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Crée un marqueur (mêmes clés que le web). */
function makeAnnotation(x: number, y: number, type: string): PlanAnnotation {
  const isNote = type === 'note';
  return {
    id: makeId(),
    x,
    y,
    type,
    label: isNote ? '' : ANNOTATION_TYPES[type]?.label ?? type,
    color: ANNOTATION_TYPES[type]?.tint,
    icon: type,
    status: isNote ? 'info' : 'planned',
    linkedTaskId: null,
    statusChangedAt: null,
    statusChangedBy: null,
    issueNotes: null,
    completedAt: null,
  };
}

export function PlanAnnotatorView({
  projectId,
  planId,
}: {
  projectId: string;
  planId: number;
}) {
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const plansQ = useQuery(() => projects.getPlans(projectId), [projectId]);
  const plan = useMemo(
    () => plansQ.data?.find((p) => p.id === planId) ?? null,
    [plansQ.data, planId],
  );

  const [anns, setAnns] = useState<PlanAnnotation[]>([]);
  const [tool, setTool] = useState<string | null>(null); // type sélectionné, ou null = déplacer
  const [editing, setEditing] = useState<PlanAnnotation | null>(null);
  const [saving, setSaving] = useState(false);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [Pdf, setPdf] = useState<React.ComponentType<any> | null>(null);
  const initedFor = useRef<number | null>(null);
  const shotRef = useRef<View>(null);

  useEffect(() => {
    if (plan && initedFor.current !== plan.id) {
      initedFor.current = plan.id;
      setAnns(plan.annotations ?? []);
    }
  }, [plan]);

  useEffect(() => {
    if (plan?.name) navigation.setOptions({ title: plan.name });
  }, [navigation, plan?.name]);

  // Taille naturelle de l'image (pour préserver le ratio).
  useEffect(() => {
    if (plan?.fileType === 'image' && plan.fileUrl) {
      Image.getSize(
        plan.fileUrl,
        (w, h) => setImgSize({ w, h }),
        () => setImgSize({ w: 1000, h: 700 }),
      );
    }
  }, [plan?.fileUrl, plan?.fileType]);

  // Chargement paresseux de react-native-pdf uniquement pour les PDF.
  useEffect(() => {
    let alive = true;
    if (plan?.fileType === 'pdf' && !Pdf) {
      import('react-native-pdf')
        .then((m) => {
          if (alive) setPdf(() => m.default as React.ComponentType<any>);
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [plan?.fileType, Pdf]);

  if (plansQ.loading) return <LoadingState label="Chargement du plan…" />;
  if (plansQ.error) return <ErrorState message={plansQ.error.message} onRetry={plansQ.refetch} />;
  if (!plan) return <ErrorState message="Plan introuvable." onRetry={plansQ.refetch} />;

  const contentW = width;
  const contentH = imgSize ? Math.round((contentW * imgSize.h) / imgSize.w) : Math.round(contentW * 0.7);

  const persist = async (next: PlanAnnotation[]) => {
    setAnns(next);
    setSaving(true);
    try {
      await projects.updatePlanAnnotations({ planId, projectId, annotations: next });
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const placeMarker = (e: GestureResponderEvent) => {
    if (!tool) return; // mode déplacement
    const { locationX, locationY } = e.nativeEvent;
    const x = Math.round((locationX / contentW) * 1000) / 10;
    const y = Math.round((locationY / contentH) * 1000) / 10;
    void persist([...anns, makeAnnotation(x, y, tool)]);
  };

  const applyEdit = (patch: Partial<PlanAnnotation>) => {
    if (!editing) return;
    const next = anns.map((a) => (a.id === editing.id ? { ...a, ...patch } : a));
    setEditing((prev) => (prev ? { ...prev, ...patch } : prev));
    void persist(next);
  };

  const deleteMarker = () => {
    if (!editing) return;
    void persist(anns.filter((a) => a.id !== editing.id));
    setEditing(null);
  };

  const exportPlan = async () => {
    try {
      const { captureRef } = await import('react-native-view-shot');
      const uri = await captureRef(shotRef, { format: 'jpg', quality: 0.9 });
      await Share.share({ url: uri, message: `Plan annoté — ${plan.name}` });
    } catch (e) {
      Alert.alert('Export impossible', e instanceof Error ? e.message : 'Réessayez.');
    }
  };

  return (
    <View style={styles.root}>
      {/* Barre d'outils : palette de types + déplacer + export */}
      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tools}>
          <ToolChip
            active={tool === null}
            label="Déplacer"
            icon="hand-back-right-outline"
            tint={colors.navy}
            onPress={() => setTool(null)}
          />
          {ANNOTATION_TYPE_KEYS.map((key) => {
            const t = ANNOTATION_TYPES[key]!;
            return (
              <ToolChip
                key={key}
                active={tool === key}
                label={t.label}
                icon={t.icon}
                tint={t.tint}
                onPress={() => setTool(key)}
              />
            );
          })}
        </ScrollView>
        <Pressable onPress={exportPlan} style={styles.exportBtn} hitSlop={8}>
          <Ionicons name="share-outline" size={22} color={colors.textOnNavy} />
        </Pressable>
      </View>

      {saving ? (
        <View style={styles.savingBar}>
          <ActivityIndicator size="small" color={colors.navy} />
          <Text style={styles.savingText}>Enregistrement…</Text>
        </View>
      ) : null}

      {tool ? (
        <Text style={styles.hint}>
          Touchez le plan pour poser un marqueur « {ANNOTATION_TYPES[tool]?.label} ».
        </Text>
      ) : null}

      {/* Viewport zoom/pan */}
      {plan.fileType === 'pdf' ? (
        <View style={styles.pdfWrap}>
          {Pdf ? (
            <Pdf source={{ uri: plan.fileUrl, cache: true }} style={styles.pdf} />
          ) : (
            <LoadingState label="Chargement du PDF…" />
          )}
          <Text style={styles.pdfNote}>
            PDF en visualisation (zoom/pan). Le placement de marqueurs est
            disponible sur les plans image ; l'annotation PDF viendra ensuite.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.viewport}
          contentContainerStyle={styles.viewportContent}
          maximumZoomScale={5}
          minimumZoomScale={1}
          bouncesZoom
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <View ref={shotRef} collapsable={false} style={{ width: contentW, height: contentH }}>
            <Pressable onPress={placeMarker}>
              <Image
                source={{ uri: plan.fileUrl }}
                style={{ width: contentW, height: contentH }}
                resizeMode="contain"
              />
              {anns.map((a) => (
                <Marker key={a.id} a={a} contentW={contentW} contentH={contentH} onPress={() => setEditing(a)} />
              ))}
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* Éditeur de marqueur */}
      <MarkerEditor
        annotation={editing}
        onClose={() => setEditing(null)}
        onChange={applyEdit}
        onDelete={deleteMarker}
      />
    </View>
  );
}

function ToolChip({
  active,
  label,
  icon,
  tint,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: tint, borderColor: tint }]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={active ? '#fff' : tint} />
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

function Marker({
  a,
  contentW,
  contentH,
  onPress,
}: {
  a: PlanAnnotation;
  contentW: number;
  contentH: number;
  onPress: () => void;
}) {
  const type = ANNOTATION_TYPES[a.type];
  const ring = annotationStatusColor(a.type, a.status);
  const left = (a.x / 100) * contentW - 16;
  const top = (a.y / 100) * contentH - 16;
  return (
    <Pressable onPress={onPress} style={[styles.marker, { left, top, borderColor: ring }]}>
      <MaterialCommunityIcons
        name={type?.icon ?? 'map-marker'}
        size={18}
        color={type?.tint ?? colors.navy}
      />
    </Pressable>
  );
}

function MarkerEditor({
  annotation,
  onClose,
  onChange,
  onDelete,
}: {
  annotation: PlanAnnotation | null;
  onClose: () => void;
  onChange: (patch: Partial<PlanAnnotation>) => void;
  onDelete: () => void;
}) {
  if (!annotation) return null;
  const isNote = annotation.type === 'note';
  const statusTable = isNote ? NOTE_STATUS : ANNOTATION_STATUS;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <MaterialCommunityIcons
            name={ANNOTATION_TYPES[annotation.type]?.icon ?? 'map-marker'}
            size={22}
            color={ANNOTATION_TYPES[annotation.type]?.tint ?? colors.navy}
          />
          <Text style={styles.sheetTitle}>{ANNOTATION_TYPES[annotation.type]?.label ?? annotation.type}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <Text style={styles.sheetLabel}>Étiquette / note</Text>
        <TextInput
          value={annotation.label}
          onChangeText={(t) => onChange({ label: t })}
          placeholder={isNote ? 'Texte de la note…' : 'Précision (ex. modèle, emplacement)…'}
          placeholderTextColor={colors.disabled}
          style={styles.sheetInput}
          multiline
        />

        <Text style={styles.sheetLabel}>Statut</Text>
        <View style={styles.statusRow}>
          {Object.entries(statusTable).map(([key, s]) => {
            const active = (annotation.status ?? (isNote ? 'info' : 'planned')) === key;
            return (
              <Pressable
                key={key}
                onPress={() => onChange({ status: key })}
                style={[styles.statusChip, active && { backgroundColor: s.color, borderColor: s.color }]}
              >
                <Text style={[styles.statusChipText, active && { color: '#fff' }]}>
                  {s.emoji} {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={onDelete} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
          <Text style={styles.deleteText}>Supprimer le marqueur</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navy,
    paddingRight: spacing.sm,
  },
  tools: { gap: spacing.sm, padding: spacing.sm, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
  },
  chipText: { fontSize: typography.small, fontWeight: typography.weightSemibold, color: colors.text },
  exportBtn: { padding: spacing.sm },
  savingBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
  savingText: { fontSize: typography.small, color: colors.textMuted },
  hint: {
    fontSize: typography.small,
    color: colors.navy,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  viewport: { flex: 1 },
  viewportContent: { flexGrow: 1, justifyContent: 'center' },
  marker: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfWrap: { flex: 1 },
  pdf: { flex: 1, backgroundColor: colors.surfaceAlt },
  pdfNote: {
    fontSize: typography.tiny,
    color: colors.textMuted,
    padding: spacing.sm,
    textAlign: 'center',
  },

  sheetBackdrop: { flex: 1, backgroundColor: '#00000055' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sheetTitle: { flex: 1, fontSize: typography.h3, fontWeight: typography.weightBold, color: colors.text },
  sheetLabel: { fontSize: typography.small, color: colors.textMuted, marginTop: spacing.sm },
  sheetInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 60,
    color: colors.text,
    textAlignVertical: 'top',
  },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  statusChipText: { fontSize: typography.small, color: colors.text, fontWeight: typography.weightMedium },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: { color: colors.danger, fontWeight: typography.weightSemibold },
});
