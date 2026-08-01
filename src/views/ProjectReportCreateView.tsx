/**
 * Création d'un rapport de projet : choix du type puis formulaire adapté.
 * Les travaux extra ouvrent en plus le bloc de facturation (heures, matériel,
 * montant à facturer). Les photos s'ajoutent ensuite depuis la fiche.
 *
 * `embedded` : rendu comme panneau détail iPad → n'écrit pas le titre du Stack.
 */
import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, TextField, SectionTitle } from '../components/Primitives';
import { Screen } from '../components/Screen';
import { projectReports } from '../api/endpoints';
import { useMutation } from '../api/useApi';
import { PROJECT_REPORT_TYPES, projectReportTypeStyle } from '../lib/format';
import type { ProjectReportType } from '../api/types';
import { colors, radius, spacing, typography } from '../theme';

/** Champ numérique optionnel → number | null (accepte la virgule décimale). */
function numOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const PLACEHOLDERS: Record<ProjectReportType, string> = {
  travaux_extra: 'Détail des travaux réalisés hors contrat…',
  avancement: "Travaux réalisés, avancement, points à surveiller…",
  fin_projet: 'Travaux livrés, réserves, remise des accès…',
  deficience: 'Une déficience par ligne, avec localisation…',
};

export function ProjectReportCreateView({
  projectId,
  embedded = false,
  onCreated,
  onCancel,
}: {
  projectId: string;
  embedded?: boolean;
  onCreated: (reportId: number) => void;
  onCancel?: () => void;
}) {
  const navigation = useNavigation();
  const create = useMutation(projectReports.create);

  const [type, setType] = useState<ProjectReportType>('travaux_extra');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [materials, setMaterials] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!embedded) navigation.setOptions({ title: 'Nouveau rapport' });
  }, [embedded, navigation]);

  const isExtra = type === 'travaux_extra';

  const submit = async () => {
    if (!title.trim()) {
      Alert.alert('Titre requis', 'Entrez un titre pour le rapport.');
      return;
    }
    if (isExtra && amount.trim() && numOrNull(amount) == null) {
      Alert.alert('Montant invalide', 'Entrez un montant positif (ex. 450.00).');
      return;
    }
    try {
      const res = await create.mutate({
        projectId,
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        hoursWorked: isExtra ? numOrNull(hours) : null,
        materials: isExtra ? materials.trim() || undefined : undefined,
        billingAmount: isExtra ? numOrNull(amount) : null,
      });
      onCreated(res.id);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Création impossible.');
    }
  };

  return (
    <Screen scroll>
      <SectionTitle>Type de rapport</SectionTitle>
      <View style={styles.typeGrid}>
        {PROJECT_REPORT_TYPES.map((opt) => {
          const t = projectReportTypeStyle(opt);
          const active = opt === type;
          return (
            <Pressable
              key={opt}
              onPress={() => setType(opt)}
              style={({ pressed }) => [
                styles.typeCard,
                { borderColor: active ? t.color : colors.border },
                active && { backgroundColor: t.bg },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.typeCardTop}>
                <Ionicons name={t.icon} size={20} color={t.color} />
                {active ? (
                  <Ionicons name="checkmark-circle" size={18} color={t.color} />
                ) : null}
              </View>
              <Text style={[styles.typeCardTitle, { color: active ? t.color : colors.text }]}>
                {t.label}
              </Text>
              <Text style={styles.typeCardHint}>{t.hint}</Text>
            </Pressable>
          );
        })}
      </View>

      <SectionTitle>Contenu</SectionTitle>
      <Card style={styles.block}>
        <TextField
          label="Titre"
          value={title}
          onChangeText={setTitle}
          placeholder={isExtra ? 'ex. Ajout de 2 caméras — 3e étage' : 'Titre du rapport'}
        />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder={PLACEHOLDERS[type]}
          multiline
          style={styles.multiline}
        />
      </Card>

      {isExtra ? (
        <>
          <SectionTitle>Facturation</SectionTitle>
          <Card style={{ ...styles.block, ...styles.billingBlock }}>
            <View style={styles.row}>
              <View style={styles.col}>
                <TextField
                  label="Heures travaillées"
                  value={hours}
                  onChangeText={setHours}
                  placeholder="0"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.col}>
                <TextField
                  label="Montant à facturer ($)"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <TextField
              label="Matériel utilisé"
              value={materials}
              onChangeText={setMaterials}
              placeholder="Un item par ligne (quantité, description)…"
              multiline
              style={styles.multiline}
            />
          </Card>
        </>
      ) : null}

      <Text style={styles.note}>
        Les photos s'ajoutent après la création, depuis la fiche du rapport.
      </Text>

      <View style={styles.actions}>
        <Button title="Créer le rapport" onPress={() => void submit()} loading={create.loading} />
        {onCancel ? (
          <Button title="Annuler" variant="ghost" onPress={onCancel} disabled={create.loading} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  typeCard: {
    flexGrow: 1,
    flexBasis: 150,
    minWidth: 150,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  typeCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typeCardTitle: { fontSize: typography.small, fontWeight: typography.weightSemibold },
  typeCardHint: { fontSize: typography.tiny, color: colors.textMuted, lineHeight: 16 },
  pressed: { opacity: 0.7 },

  block: { marginBottom: spacing.lg },
  billingBlock: { borderColor: colors.gold, borderWidth: 1.5 },
  multiline: { minHeight: 110, paddingTop: spacing.md, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1 },
  note: {
    fontSize: typography.tiny,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  actions: { gap: spacing.sm },
});
