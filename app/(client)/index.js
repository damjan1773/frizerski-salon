import { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, SafeAreaView, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';

export default function HomeScreen() {
    const [profile, setProfile] = useState(null);
    const [barbers, setBarbers] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            setProfile(profileData);

            const { data: barbersData } = await supabase
                .from('barbers')
                .select(`
          *,
          profiles (full_name, avatar_url),
          salons (name, address)
        `)
                .eq('is_active', true);

            setBarbers(barbersData || []);
        } catch (error) {
            console.log('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
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
            <ScrollView showsVerticalScrollIndicator={false}>

                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greeting}>Zdravo, {profile?.full_name?.split(' ')[0]} 👋</Text>
                        <Text style={styles.subtitle}>Zakaži termin danas</Text>
                    </View>
                    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                        <Text style={styles.logoutText}>Odjavi se</Text>
                    </TouchableOpacity>
                </View>

                {/* Banner */}
                <View style={styles.banner}>
                    <Text style={styles.bannerTitle}>✂️ Frizerski Salon</Text>
                    <Text style={styles.bannerSubtitle}>Profesionalni frizeri na jednom mestu</Text>
                </View>

                {/* Frizeri */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Naši frizeri</Text>

                    {barbers.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>✂️</Text>
                            <Text style={styles.emptyText}>Frizeri će uskoro biti dostupni</Text>
                        </View>
                    ) : (
                        barbers.map((barber) => (
                            <TouchableOpacity
                                key={barber.id}
                                style={styles.barberCard}
                                onPress={() => router.push(`/(client)/barber/${barber.id}`)}
                            >
                                <View style={styles.barberAvatar}>
                                    <Text style={styles.barberAvatarText}>
                                        {barber.profiles?.full_name?.charAt(0) || '?'}
                                    </Text>
                                </View>
                                <View style={styles.barberInfo}>
                                    <Text style={styles.barberName}>{barber.profiles?.full_name}</Text>
                                    <Text style={styles.barberSalon}>{barber.salons?.name}</Text>
                                    <Text style={styles.barberAddress}>{barber.salons?.address}</Text>
                                </View>
                                <View style={styles.ratingBadge}>
                                    <Text style={styles.ratingText}>⭐ {barber.rating}</Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.lg,
        paddingTop: SPACING.md,
    },
    greeting: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.textLight,
        marginTop: 2,
    },
    logoutBtn: {
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.sm,
        backgroundColor: COLORS.grayLight,
    },
    logoutText: {
        fontSize: 13,
        color: COLORS.gray,
        fontWeight: '600',
    },
    banner: {
        margin: SPACING.lg,
        marginTop: 0,
        padding: SPACING.xl,
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
    },
    bannerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: SPACING.xs,
    },
    bannerSubtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
    },
    section: {
        padding: SPACING.lg,
        paddingTop: 0,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: SPACING.md,
    },
    emptyState: {
        alignItems: 'center',
        padding: SPACING.xxl,
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.lg,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: SPACING.md,
    },
    emptyText: {
        fontSize: 16,
        color: COLORS.textLight,
        textAlign: 'center',
    },
    barberCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
    },
    barberAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: SPACING.md,
    },
    barberAvatarText: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    barberInfo: {
        flex: 1,
    },
    barberName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    barberSalon: {
        fontSize: 13,
        color: COLORS.primary,
        marginTop: 2,
    },
    barberAddress: {
        fontSize: 12,
        color: COLORS.textLight,
        marginTop: 2,
    },
    ratingBadge: {
        backgroundColor: '#FFF9E6',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
    },
    ratingText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#B8860B',
    },
});