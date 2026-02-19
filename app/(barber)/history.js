import { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, SafeAreaView, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { formatPhone, formatDateLocal } from '../../lib/helpers';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

export default function HistoryScreen() {
    const router = useRouter();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { data: barberData } = await supabase
                .from('barbers')
                .select('id')
                .eq('profile_id', user.id)
                .single();

            if (barberData) {
                // Datum od pre 7 dana
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const startDate = formatDateLocal(sevenDaysAgo);

                // Današnji datum
                const today = formatDateLocal(new Date());

                const { data: apptData } = await supabase
                    .from('appointments')
                    .select(`
                        *,
                        profiles!appointments_client_id_fkey(full_name, phone),
                        services(name, duration_minutes, price)
                    `)
                    .eq('barber_id', barberData.id)
                    .gte('appointment_date', startDate)
                    .lt('appointment_date', today)
                    .order('appointment_date', { ascending: false })
                    .order('start_time', { ascending: false });

                setAppointments(apptData || []);
            }
        } catch (error) {
            console.log('Error:', error);
        } finally {
            setLoading(false);
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
            case 'confirmed': return 'Potvrđen';
            case 'cancelled': return 'Otkazan';
            case 'completed': return 'Završen';
            default: return status;
        }
    };

    const groupByDate = (appointments) => {
        const grouped = {};
        appointments.forEach(appt => {
            if (!grouped[appt.appointment_date]) {
                grouped[appt.appointment_date] = [];
            }
            grouped[appt.appointment_date].push(appt);
        });
        return grouped;
    };

    const groupedAppointments = groupByDate(appointments);

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
                <Text style={styles.headerTitle}>Istorija termina</Text>
                <View style={{ width: 80 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>

                {Object.keys(groupedAppointments).length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📅</Text>
                        <Text style={styles.emptyTitle}>Nema termina u poslednjih 7 dana</Text>
                    </View>
                ) : (
                    Object.keys(groupedAppointments).map((date) => {
                        const dateObj = new Date(date + 'T00:00:00');
                        const dayAppointments = groupedAppointments[date];

                        return (
                            <View key={date} style={styles.dateGroup}>
                                <View style={styles.dateHeader}>
                                    <Text style={styles.dateTitle}>
                                        {dateObj.getDate()}. {MONTHS[dateObj.getMonth()]}
                                    </Text>
                                    <Text style={styles.dateCount}>
                                        {dayAppointments.filter(a => a.status !== 'cancelled').length} termina
                                        ({dayAppointments
                                        .filter(a => a.status !== 'cancelled')
                                        .reduce((sum, a) => sum + (a.services?.price || 0), 0)} RSD)
                                    </Text>
                                </View>

                                {dayAppointments.map((appt) => (
                                    <View key={appt.id} style={[
                                        styles.apptCard,
                                        appt.status === 'cancelled' && styles.apptCardCancelled,
                                    ]}>
                                        <View style={styles.apptTime}>
                                            <Text style={[styles.apptTimeText, appt.status === 'cancelled' && styles.textFaded]}>
                                                {appt.start_time?.slice(0, 5)}
                                            </Text>
                                            <Text style={styles.apptTimeEnd}>{appt.end_time?.slice(0, 5)}</Text>
                                        </View>
                                        <View style={styles.apptInfo}>
                                            <Text style={[styles.apptClient, appt.status === 'cancelled' && styles.textFaded]}>
                                                {appt.notes?.startsWith('Telefonska')
                                                    ? appt.notes.split('—')[1]?.split(',')[0]?.trim()
                                                    : appt.profiles?.full_name}
                                            </Text>
                                            <Text style={styles.apptService}>{appt.services?.name}</Text>
                                            <Text style={styles.apptPhone}>
                                                📞 {appt.notes?.startsWith('Telefonska')
                                                ? formatPhone(appt.notes.split(',')[1]?.trim())
                                                : formatPhone(appt.profiles?.phone)}
                                            </Text>
                                            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appt.status) + '20' }]}>
                                                <Text style={[styles.statusText, { color: getStatusColor(appt.status) }]}>
                                                    {getStatusText(appt.status)}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={styles.apptPrice}>
                                            <Text style={styles.priceText}>{appt.services?.price} RSD</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        );
                    })
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
    content: { flex: 1, padding: SPACING.lg },
    emptyState: {
        alignItems: 'center',
        paddingTop: SPACING.xxl * 2,
        paddingHorizontal: SPACING.lg,
    },
    emptyIcon: { fontSize: 64, marginBottom: SPACING.md },
    emptyTitle: { fontSize: 16, color: COLORS.textLight, textAlign: 'center' },
    dateGroup: { marginBottom: SPACING.lg },
    dateHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.sm,
        paddingBottom: SPACING.xs,
        borderBottomWidth: 2,
        borderBottomColor: COLORS.primary,
    },
    dateTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
    dateCount: { fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
    apptCard: {
        flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm, alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    apptCardCancelled: { opacity: 0.5 },
    apptTime: { alignItems: 'center', marginRight: SPACING.md, minWidth: 48 },
    apptTimeText: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
    apptTimeEnd: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    textFaded: { color: COLORS.textLight },
    apptInfo: { flex: 1 },
    apptClient: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
    apptService: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
    apptPhone: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 2,
        borderRadius: BORDER_RADIUS.full,
        marginTop: SPACING.xs
    },
    statusText: { fontSize: 11, fontWeight: '700' },
    apptPrice: { marginLeft: SPACING.sm },
    priceText: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
    callBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#E3F2FD',
        justifyContent: 'center', alignItems: 'center'
    },
    callBtnText: { fontSize: 16 },
});