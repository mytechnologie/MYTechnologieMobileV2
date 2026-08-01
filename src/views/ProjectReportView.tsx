/**
 * Fiche d'un rapport de projet (travaux extra, avancement, fin, déficiences) :
 * - en-tête typé (pastille de type + statut),
 * - bloc facturation mis en avant pour les travaux extra,
 * - description, photos (mêmes routes REST que les tâches projet),
 * - génération / ouverture du PDF (PDFShift → R2) et envoi au client.
 *
 * `embedded` : rendu comme panneau détail iPad → n'écrit pas le titre du Stack.
 */
import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, InfoRow, SectionTitle } from '../components/Primitives';
import { Screen } from '../components/Screen';
import { ErrorState, LoadingState } from '../components/States';
import { PhotoSection } from '../components/PhotoSection';
import { projectReports } from '../api/endpoints';
import { useMutation, useQuery } from '../api/useApi';
import {
  formatCAD,
  formatDate,
  projectReportStatusStyle,
  projectReportTypeStyle,
} from '../lib/format';
import { colors, radius, spacing, typography } from '../theme';

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Titre de la section descriptive selon le type de rapport. */
function descriptionTitle(type: string): string {
  if (type === 'deficience') return 'Déficiences constatées';
  if (type === 'fin_projet') return 'Constat de fin de projet';
  if (type === 'avancement') return "État d'avancement";
  return 'Description des travaux';
}

export function ProjectReportView({
  reportId,
  embedded = false,
  onChanged,
}: {
  reportId: number;
  embedded?: boolean;
  /** Prévient la liste maître (iPad) qu'il faut se rafraîchir. */
  onChanged?: () => void;
}) {
  const navigation = useNavigation();

  const reportQ = useQuery(() => projectReports.getById(reportId), [reportId]);
  const photosQ = useQuery(() => projectReports.getPhotoUrls(reportId), [reportId]);
  const pdfMut = useMutation((id: number) => projectReports.generatePdf(id));
  const emailMut = useMutation((id: number) => projectReports.email(id));
  const updateMut = useMutation(projectReports.update);

  const [busy, setBusy] = useState(false);

  const report = reportQ.data?.report;

  useEffect(() => {
    if (!embedded && report?.reportNumber) {
      navigation.setOptions({ title: report.reportNumber });
    }
  }, [embedded, navigation, report?.reportNumber]);

  if (reportQ.loading) return <LoadingState label="Chargement du rapport…" />;
  if (reportQ.error || !reportQ.data || !report) {
    return <ErrorState message={reportQ.error?.message} onRetry={reportQ.refetch} />;
  }

  const data = reportQ.data;
  const t = projectReportTypeStyle(report.type);
  const s = projectReportStatusStyle(report.status);
  const isExtra = report.type === 'travaux_extra';
  const hours = toNumber(report.hoursWorked);

  const openPdf = async () => {
    setBusy(true);
    try {
      const { url } = await pdfMut.mutate(reportId);
      await Linking.openURL(url);
      reportQ.refetch();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Génération du PDF impossible.');
    } finally {
      setBusy(false);
    }
  };

  const sendToClient = () => {
    const target = data.clientEmail;
    Alert.alert(
      'Envoyer au client',
      target
        ? `Le PDF sera régénéré et envoyé à ${target}.`
        : "Aucun courriel n'est enregistré pour ce client. L'envoi échouera — ajoutez une adresse depuis le portail web.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Envoyer',
          onPress: async () => {
            setBusy(true);
            try {
              const res = await emailMut.mutate(reportId);
              Alert.alert('Envoyé', `Rapport envoyé à ${res.sentTo}.`);
              reportQ.refetch();
              onChanged?.();
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Envoi impossible.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const markCompleted = async () => {
    setBusy(true);
    try {
      await updateMut.mutate({ id: reportId, status: 'completed' });
      reportQ.refetch();
      onChanged?.();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Mise à jour impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll refreshing={reportQ.refreshing} onRefresh={reportQ.refetch}>
      {/* En-tête */}
      <Card style={styles.headerCard}>
        <View style={[styles.typeStrip, { backgroundColor: t.color }]} />
        <Text style={styles.number}>{report.reportNumber}</Text>
        <Text style={styles.title}>{report.title}</Text>
        <View style={styles.tags}>
          <View style={[styles.typeChip, { backgroundColor: t.bg }]}>
            <Ionicons name={t.icon} size={13} color={t.color} />
            <Text style={[styles.typeChipText, { color: t.color }]}>{t.label}</Text>
          </View>
          <Badge label={s.label} color={s.color} bg={s.bg} />
        </View>
      </Card>

      {/* Montant à facturer — l'information clé d'un travail extra */}
      {isExtra ? (
        <Card style={styles.billingCard}>
          <Text style={styles.billingLabel}>Montant à facturer</Text>
          <Text style={styles.billingAmount}>{formatCAD(report.billingAmount)}</Text>
          <View style={styles.billingMeta}>
            <InfoRow
              label="Heures travaillées"
              value={hours != null ? `${hours.toLocaleString('fr-CA')} h` : '—'}
            />
            <InfoRow label="Matériel" value={report.materials?.trim() || '—'} />
          </View>
        </Card>
      ) : null}

      {/* Informations */}
      <SectionTitle>Informations</SectionTitle>
      <Card style={styles.block}>
        <InfoRow label="Projet" value={data.projectName ?? '—'} />
        {data.clientName ? <InfoRow label="Client" value={data.clientName} /> : null}
        {data.projectLocation ? <InfoRow label="Lieu" value={data.projectLocation} /> : null}
        <InfoRow label="Technicien" value={data.technicianName ?? 'Non assigné'} />
        <InfoRow label="Rédigé par" value={data.createdByName ?? '—'} />
        <InfoRow label="Créé le" value={formatDate(report.createdAt)} />
        {report.sentAt ? <InfoRow label="Envoyé le" value={formatDate(report.sentAt)} /> : null}
        {report.completedAt ? (
          <InfoRow label="Complété le" value={formatDate(report.completedAt)} />
        ) : null}
      </Card>

      {/* Description */}
      <SectionTitle>{descriptionTitle(report.type)}</SectionTitle>
      <Card style={styles.block}>
        <Text style={report.description ? styles.desc : styles.muted}>
          {report.description?.trim() || 'Aucune description.'}
        </Text>
      </Card>

      {/* Photos */}
      <SectionTitle>Photos</SectionTitle>
      <Card style={styles.block}>
        <PhotoSection
          urls={photosQ.data}
          loading={photosQ.loading}
          upload={(file) => projectReports.uploadPhoto(reportId, file)}
          remove={(photoId) => projectReports.deletePhoto(reportId, photoId)}
          onChanged={() => {
            photosQ.refetch();
            reportQ.refetch();
            onChanged?.();
          }}
        />
      </Card>

      {/* Actions */}
      <SectionTitle>Document</SectionTitle>
      <View style={styles.actions}>
        <Button
          title="Générer et ouvrir le PDF"
          onPress={() => void openPdf()}
          loading={pdfMut.loading}
          disabled={busy}
        />
        <Button
          title="Envoyer au client"
          variant="gold"
          onPress={sendToClient}
          loading={emailMut.loading}
          disabled={busy}
        />
        {report.status !== 'completed' ? (
          <Button
            title="Marquer complété"
            variant="secondary"
            onPress={() => void markCompleted()}
            loading={updateMut.loading}
            disabled={busy}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
    overflow: 'hidden',
    paddingLeft: spacing.lg + 4,
  },
  typeStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  number: {
    fontSize: typography.tiny,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: typography.h2,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  typeChipText: { fontSize: typography.tiny, fontWeight: typography.weightSemibold },

  billingCard: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
    borderColor: colors.gold,
    borderWidth: 1.5,
  },
  billingLabel: {
    fontSize: typography.tiny,
    fontWeight: typography.weightSemibold,
    color: colors.goldDark,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  billingAmount: {
    fontSize: 34,
    fontWeight: typography.weightBold,
    color: colors.navy,
    lineHeight: 40,
  },
  billingMeta: { marginTop: spacing.sm },

  block: { marginBottom: spacing.lg },
  desc: { fontSize: typography.small, color: colors.text, lineHeight: 21 },
  muted: { fontSize: typography.tiny, color: colors.textMuted },
  actions: { gap: spacing.sm, marginBottom: spacing.lg },
});
