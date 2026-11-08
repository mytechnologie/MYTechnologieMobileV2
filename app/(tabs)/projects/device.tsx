/**
 * Fiche terrain d'un appareil : statut (prévu → installé → configuré →
 * vérifié), numéro de série et MAC (saisis ou scannés), réseau et notes.
 * Enregistré par projects.fieldUpdateDevice.
 */
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarcodeScanner } from '../../../src/components/BarcodeScanner';
import { Button, Card, TextField } from '../../../src/components/Primitives';
import { Screen } from '../../../src/components/Screen';
import { ErrorState, LoadingState } from '../../../src/components/States';
import { projects as projectsApi } from '../../../src/api/endpoints';
import { useQuery } from '../../../src/api/useApi';
import { DEVICE_STATUS_OPTIONS, deviceStatusStyle } from '../../../src/lib/format';
import type { DeviceStatus, ProjectDevice } from '../../../src/api/types';
import { colors, radius, spacing, typography } from '../../../src/theme';

type Form = {
  status: DeviceStatus;
  serialNumber: string;
  macAddress: string;
  ipAddress: string;
  switchName: string;
  switchPort: string;
  firmware: string;
  notes: string;
};

function formOf(d: ProjectDevice): Form {
  return {
    status: d.status,
    serialNumber: d.serialNumber ?? '',
    macAddress: d.macAddress ?? '',
    ipAddress: d.ipAddress ?? '',
    switchName: d.switchName ?? '',
    switchPort: d.switchPort ?? '',
    firmware: d.firmware ?? '',
    notes: d.notes ?? '',
  };
}

/** Adresse MAC lue sur une étiquette : 12 hex, remis au format AA:BB:CC:DD:EE:FF. */
function normalizeMac(raw: string): string {
  const hex = raw.replace(/[^0-9a-f]/gi, '').toUpperCase();
  return hex.length === 12 ? hex.match(/.{2}/g)!.join(':') : raw;
}

export default function DeviceScreen() {
  const { projectId, deviceId } = useLocalSearchParams<{ projectId: string; deviceId: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const q = useQuery(() => projectsApi.getById(String(projectId)), [projectId]);
  const device = q.data?.devices.find(d => d.id === String(deviceId)) ?? null;

  const [form, setForm] = useState<Form | null>(null);
  const [scanFor, setScanFor] = useState<'serialNumber' | 'macAddress' | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (device && !form) setForm(formOf(device));
    if (device) navigation.setOptions({ title: device.name });
  }, [device, form, navigation]);

  if (q.loading) return <LoadingState label="Chargement de l'appareil…" />;
  if (q.error) return <ErrorState message={q.error.message} onRetry={q.refetch} />;
  if (!device || !form) return <ErrorState message="Appareil introuvable." onRetry={q.refetch} />;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    setSaving(true);
    try {
      await projectsApi.updateDevice({
        id: device.id,
        status: form.status,
        serialNumber: form.serialNumber.trim(),
        macAddress: form.macAddress.trim(),
        ipAddress: form.ipAddress.trim(),
        switchName: form.switchName.trim(),
        switchPort: form.switchPort.trim(),
        firmware: form.firmware.trim(),
        notes: form.notes.trim() || null,
      });
      router.back();
    } catch (e) {
      Alert.alert('Appareil', e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const scanButton = (field: 'serialNumber' | 'macAddress') => (
    <Pressable
      style={styles.scan}
      onPress={() => setScanFor(field)}
      accessibilityRole="button"
      accessibilityLabel="Scanner l'étiquette"
    >
      <Ionicons name="barcode-outline" size={22} color={colors.navy} />
      <Text style={styles.scanText}>Scanner</Text>
    </Pressable>
  );

  return (
    <Screen scroll>
      <Card style={styles.block}>
        <Text style={styles.name}>{device.name}</Text>
        <Text style={styles.muted}>
          {[device.zone, device.location, device.manufacturer, device.model].filter(Boolean).join(' · ') ||
            device.deviceType}
        </Text>
        {device.installedByName ? (
          <Text style={styles.muted}>Installé par {device.installedByName}</Text>
        ) : null}
      </Card>

      <Text style={styles.section}>STATUT</Text>
      <View style={styles.chips}>
        {DEVICE_STATUS_OPTIONS.map(s => {
          const on = form.status === s;
          const st = deviceStatusStyle(s);
          return (
            <Pressable
              key={s}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => set('status', s)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{st.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.block}>
        <View style={styles.withScan}>
          <View style={styles.flex}>
            <TextField
              label="Numéro de série"
              value={form.serialNumber}
              onChangeText={v => set('serialNumber', v)}
              autoCapitalize="characters"
            />
          </View>
          {scanButton('serialNumber')}
        </View>
        <View style={styles.withScan}>
          <View style={styles.flex}>
            <TextField
              label="Adresse MAC"
              value={form.macAddress}
              onChangeText={v => set('macAddress', v)}
              autoCapitalize="characters"
              placeholder="AA:BB:CC:DD:EE:FF"
            />
          </View>
          {scanButton('macAddress')}
        </View>
        <TextField
          label="Adresse IP"
          value={form.ipAddress}
          onChangeText={v => set('ipAddress', v)}
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Switch" value={form.switchName} onChangeText={v => set('switchName', v)} />
          </View>
          <View style={styles.flex}>
            <TextField label="Port" value={form.switchPort} onChangeText={v => set('switchPort', v)} />
          </View>
        </View>
        <TextField label="Firmware" value={form.firmware} onChangeText={v => set('firmware', v)} />
        <TextField label="Notes" value={form.notes} onChangeText={v => set('notes', v)} multiline />
      </Card>

      <Button title="Enregistrer" variant="gold" loading={saving} onPress={save} style={styles.save} />

      <BarcodeScanner
        visible={scanFor !== null}
        title={scanFor === 'macAddress' ? 'Scanner l’adresse MAC' : 'Scanner le numéro de série'}
        onClose={() => setScanFor(null)}
        onScanned={value => {
          if (scanFor) set(scanFor, scanFor === 'macAddress' ? normalizeMac(value) : value);
          setScanFor(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.md, gap: spacing.xs },
  name: { fontSize: typography.h3, fontWeight: typography.weightBold, color: colors.text },
  muted: { fontSize: typography.small, color: colors.textMuted },
  section: { fontSize: typography.tiny, fontWeight: typography.weightBold, color: colors.textMuted, marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: typography.small, fontWeight: typography.weightSemibold, color: colors.navy },
  chipTextOn: { color: colors.textOnNavy },
  withScan: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  scan: {
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  scanText: { fontSize: typography.tiny, color: colors.navy, fontWeight: typography.weightSemibold },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  save: { marginBottom: spacing.xl },
});
