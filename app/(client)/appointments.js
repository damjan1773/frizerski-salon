import { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, SafeAreaView, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { cancelAppointmentReminder } from '../../lib/notifications';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

export default function AppointmentsScreen() {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('upcoming');
    const router = useRouter();

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { data } = await supabase
                .from('appointments')
                .select(`
          *,
          services(name, duration_minutes, price),
          barbers(
            profiles(full_name),
            salons(name, address)
          )
        `)
                .eq('client_id', user.id)
                .order('appointment_date', { ascending: false })
                .order('start_time', { ascending: false });

            setAppointments(data || []);
        } catch (error) {
            console.log('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (appointmentId) => {
        Alert.alert(
            'Otkaži termin',
            'Da li ste sigurni da želite da otkažete termin?',
            [
                { text: 'Ne', style: 'cancel' },
                {
                    text: 'Da, otkaži',
                    style: 'destructive',
                    onPress: async () => {
                        // Dohvati notification_id i otkaži podsetnik
                        const { data: appt } = await supabase
                            .from('appointments')
                            .select('notification_id')
                            .eq('id', appointmentId)
                            .single();

                        await cancelAppointmentReminder(appt?.notification_id);

                        await supabase
                            .from('appointments')
                            .update({ status: 'cancelled' })
                            .eq('id', appointmentId);

                        fetchAppointments();
                    }
                }
            ]
        );
    };

    const getFilteredAppointments = () => {
        const today = new Date().toISOString().split('T')[0];
        if (filter === 'upcoming') {
            return appointments.filter(a =>
                a.appointment_date >= today && a.status !== 'cancelled'
            );
        } else {
            return appointments.filter(a =>
                a.appointment_date < today || a.status === 'cancelled' || a.status === 'completed'
            );
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'confirmed': return '#28A745';
            case 'cancelled': return '#DC3545';
            case 'completed': return '#6C757D';
            default: return COLORS.gray;
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'confirmed': return '✓ Potvrđen';
            case 'cancelled': return '✕ Otkazan';
            case 'completed': return '✓✓ Završen';
            default: return status;
        }
    };

    const filtered = getFilteredAppointments();

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>← Nazad</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Moji termini</Text>
                <View style={{ width: 80 }} />
            </View>

            {/* Filter */}
            <View style={styles.filterRow}>
                <TouchableOpacity
                    style={[styles.filterBtn, filter === 'upcoming' && styles.filterBtnActive]}
                    onPress={() => setFilter('upcoming')}
                >
                    <Text style={[styles.filterText, filter === 'upcoming' && styles.filterTextActive]}>
                        Predstojeći
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterBtn, filter === 'past' && styles.filterBtnActive]}
                    onPress={() => setFilter('past')}
                >
                    <Text style={[styles.filterText, filter === 'past' && styles.filterTextActive]}>
                        Prošli
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
                {filtered.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📅</Text>
                        <Text style={styles.emptyTitle}>
                            {filter === 'upcoming' ? 'Nema predstojecih termina' : 'Nema prošlih termina'}
                        </Text>
                        {filter === 'upcoming' && (
                            <TouchableOpacity
                                style={styles.bookNowBtn}
                                onPress={() => router.back()}
                            >
                                <Text style={styles.bookNowText}>Zakaži termin</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    filtered.map((appt) => (
                        <View key={appt.id} style={styles.apptCard}>

                            {/* Datum i status */}
                            <View style={styles.apptHeader}>
                                <View style={styles.dateBox}>
                                    <Text style={styles.dateDay}>{new Date(appt.appointment_date + 'T00:00:00').getDate()}</Text>
                                    <Text style={styles.dateMonth}>
                                        {MONTHS[new Date(appt.appointment_date).getMonth()]}
                                    </Text>
                                </View>
                                <View style={styles.apptMain}>
                                    <Text style={styles.apptService}>{appt.services?.name}</Text>
                                    <Text style={styles.apptSalon}>✂️ {appt.barbers?.salons?.name}</Text>
                                    <Text style={styles.apptTime}>
                                        ⏰ {appt.start_time?.slice(0, 5)} - {appt.end_time?.slice(0, 5)}
                                    </Text>
                                    <Text style={styles.apptPrice}>💰 {appt.services?.price} RSD</Text>
                                </View>
                            </View>

                            {/* Status i akcije */}
                            <View style={styles.apptFooter}>
                                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appt.status) + '20' }]}>
                                    <Text style={[styles.statusText, { color: getStatusColor(appt.status) }]}>
                                        {getStatusText(appt.status)}
                                    </Text>
                                </View>
                                {appt.status === 'confirmed' &&
                                    new Date(appt.appointment_date) > new Date() && (
                                        <TouchableOpacity
                                            style={styles.cancelBtn}
                                            onPress={() => handleCancel(appt.id)}
                                        >
                                            <Text style={styles.cancelBtnText}>Otkaži</Text>
                                        </TouchableOpacity>
                                    )}
                            </View>

                        </View>
                    ))
                )}
            </ScrollView>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: SPACING.lg, paddingTop: SPACING.md,
        backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight,
    },
    backBtn: { padding: SPACING.xs },
    backBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
    filterRow: {
        flexDirection: 'row', padding: SPACING.md,
        gap: SPACING.sm, backgroundColor: COLORS.white,
        borderBottomWidth: 1, borderBottomColor: COLORS.grayLight,
    },
    filterBtn: {
        flex: 1, padding: SPACING.sm, borderRadius: BORDER_RADIUS.md,
        alignItems: 'center', backgroundColor: COLORS.grayLight,
    },
    filterBtnActive: { backgroundColor: COLORS.primary },
    filterText: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
    filterTextActive: { color: COLORS.white },
    list: { padding: SPACING.lg },
    emptyState: { alignItems: 'center', paddingTop: SPACING.xxl },
    emptyIcon: { fontSize: 64, marginBottom: SPACING.md },
    emptyTitle: { fontSize: 16, color: COLORS.textLight, marginBottom: SPACING.lg },
    bookNowBtn: {
        backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl,
        paddingVertical: SPACING.md, borderRadius: BORDER_RADIUS.lg,
    },
    bookNowText: { color: COLORS.white, fontWeight: 'bold', fontSize: 15 },
    apptCard: {
        backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.md,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    apptHeader: { flexDirection: 'row', marginBottom: SPACING.sm },
    dateBox: {
        width: 52, height: 52, borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.primary, justifyContent: 'center',
        alignItems: 'center', marginRight: SPACING.md,
    },
    dateDay: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
    dateMonth: { fontSize: 11, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
    apptMain: { flex: 1 },
    apptService: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    apptSalon: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
    apptTime: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
    apptPrice: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
    apptFooter: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginTop: SPACING.sm,
        paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.grayLight,
    },
    statusBadge: {
        paddingHorizontal: SPACING.sm, paddingVertical: 4,
        borderRadius: BORDER_RADIUS.full,
    },
    statusText: { fontSize: 12, fontWeight: '700' },
    cancelBtn: {
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.md, borderWidth: 1.5, borderColor: '#DC3545',
    },
    cancelBtnText: { fontSize: 13, color: '#DC3545', fontWeight: '600' },
});