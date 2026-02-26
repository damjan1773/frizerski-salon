import { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, StyleSheet, SafeAreaView,
    ActivityIndicator, TouchableOpacity
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';

export default function ClientsScreen() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { data: barberData } = await supabase
                .from('barbers')
                .select('id')
                .eq('profile_id', user.id)
                .single();

            if (!barberData) return;

            // Dohvati sve klijente (role = 'client')
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, phone')
                .eq('role', 'client');

            if (!profiles || profiles.length === 0) {
                setClients([]);
                return;
            }

            // Dohvati sve termine za ovog frizera
            const { data: appointments } = await supabase
                .from('appointments')
                .select('client_id, status, notes, services(price)')
                .eq('barber_id', barberData.id);

            // Izgradi mapu statistika po klijentu
            const statsMap = {};
            appointments?.forEach(appt => {
                if (appt.notes?.startsWith('Telefonska')) return;
                const id = appt.client_id;
                if (!id) return;
                if (!statsMap[id]) {
                    statsMap[id] = { booked: 0, cancelled: 0, totalSpent: 0 };
                }
                if (appt.status === 'cancelled') {
                    statsMap[id].cancelled++;
                } else {
                    statsMap[id].booked++;
                    statsMap[id].totalSpent += appt.services?.price || 0;
                }
            });

            // Spoji profile sa statistikama
            const result = profiles.map(p => ({
                id: p.id,
                name: p.full_name || 'Nepoznat',
                phone: p.phone || null,
                booked: statsMap[p.id]?.booked || 0,
                cancelled: statsMap[p.id]?.cancelled || 0,
                totalSpent: statsMap[p.id]?.totalSpent || 0,
            }));

            const sorted = result.sort((a, b) =>
                a.name.localeCompare(b.name, 'sr')
            );
            setClients(sorted);
        } catch (error) {
            console.log('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>← Nazad</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Klijenti</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                {clients.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>👥</Text>
                        <Text style={styles.emptyText}>Nema klijenata koji su koristili aplikaciju</Text>
                    </View>
                ) : (
                    clients.map(client => (
                        <View key={client.id} style={styles.card}>
                            <View style={styles.cardTop}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {client.name?.charAt(0)?.toUpperCase() || '?'}
                                    </Text>
                                </View>
                                <View style={styles.clientInfo}>
                                    <Text style={styles.clientName} numberOfLines={1}>
                                        {client.name}
                                    </Text>
                                    <Text style={styles.clientPhone} numberOfLines={1}>
                                        {client.phone ? `📞 ${client.phone}` : 'Nema broja telefona'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{client.booked}</Text>
                                    <Text style={styles.statLabel}>Zakazano</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={[styles.statValue, client.cancelled > 0 && styles.statValueRed]}>
                                        {client.cancelled}
                                    </Text>
                                    <Text style={styles.statLabel}>Otkazano</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={[styles.statValue, styles.statValueGreen]}>
                                        {client.totalSpent.toLocaleString()}
                                    </Text>
                                    <Text style={styles.statLabel}>RSD potrošeno</Text>
                                </View>
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.lg,
        paddingTop: SPACING.md,
    },
    backBtn: {
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.sm,
        backgroundColor: COLORS.grayLight,
        minWidth: 80,
    },
    backBtnText: {
        fontSize: 13,
        color: COLORS.gray,
        fontWeight: '600',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    headerSpacer: { minWidth: 80 },
    scroll: {
        padding: SPACING.lg,
        paddingTop: 0,
        paddingBottom: SPACING.xl,
    },
    emptyState: {
        alignItems: 'center',
        padding: SPACING.xxl,
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.lg,
        marginTop: SPACING.md,
    },
    emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
    emptyText: { fontSize: 16, color: COLORS.textLight, textAlign: 'center' },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.md,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    clientInfo: { flex: 1 },
    clientName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    clientPhone: {
        fontSize: 13,
        color: COLORS.textLight,
        marginTop: 2,
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: COLORS.background,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.sm,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: SPACING.xs,
    },
    statDivider: {
        width: 1,
        backgroundColor: COLORS.grayLight,
        marginVertical: 4,
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    statValueRed: {
        color: COLORS.error,
    },
    statValueGreen: {
        color: COLORS.success,
        fontSize: 15,
    },
    statLabel: {
        fontSize: 11,
        color: COLORS.textLight,
        marginTop: 2,
        textAlign: 'center',
    },
});
