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
    const [barber, setBarber] = useState(null);
    const [services, setServices] = useState([]);
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

            const { data: barberData } = await supabase
                .from('barbers')
                .select(`*, profiles(full_name), salons(name, address)`)
                .eq('is_active', true)
                .single();

            setBarber(barberData);

            if (barberData) {
                const { data: servicesData } = await supabase
                    .from('services')
                    .select('*')
                    .eq('barber_id', barberData.id);

                setServices(servicesData || []);
            }
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
                    </View>
                    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                        <Text style={styles.logoutText}>Odjavi se</Text>
                    </TouchableOpacity>
                </View>

                {/* Salon Info */}
                {barber && (
                    <View style={styles.salonBanner}>
                        <Text style={styles.salonName}>✂️ {barber.salons?.name}</Text>
                        <Text style={styles.salonAddress}>📍 {barber.salons?.address}</Text>
                        <View style={styles.barberRow}>
                            <View style={styles.barberAvatar}>
                                <Text style={styles.barberAvatarText}>
                                    {barber.profiles?.full_name?.charAt(0)}
                                </Text>
                            </View>
                            <View>
                                <Text style={styles.barberName}>{barber.profiles?.full_name}</Text>
                                {/*<Text style={styles.barberRating}>⭐ {barber.rating} · Profesionalni frizer</Text>*/}
                            </View>
                        </View>
                    </View>
                )}

                {/* Usluge */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Izaberi uslugu</Text>
                    {services.map((service) => (
                        <TouchableOpacity
                            key={service.id}
                            style={styles.serviceCard}
                            onPress={() => router.push({
                                pathname: '/(client)/booking',
                                params: {
                                    serviceId: service.id,
                                    serviceName: service.name,
                                    servicePrice: service.price,
                                    serviceDuration: service.duration_minutes,
                                    barberId: barber.id,
                                    barberName: barber.profiles?.full_name,
                                }
                            })}
                        >
                            <View style={styles.serviceInfo}>
                                <Text style={styles.serviceName}>{service.name}</Text>
                                <Text style={styles.serviceDescription}>{service.description}</Text>
                                <Text style={styles.serviceDuration}>⏱ {service.duration_minutes} min</Text>
                            </View>
                            <View style={styles.servicePriceContainer}>
                                <Text style={styles.servicePrice}>{service.price} RSD</Text>
                                <Text style={styles.serviceArrow}>→</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Moji termini dugme */}
                <TouchableOpacity
                    style={styles.appointmentsBtn}
                    onPress={() => router.push('/(client)/appointments')}
                >
                    <Text style={styles.appointmentsBtnText}>📅 Moji termini</Text>
                </TouchableOpacity>

                {/* Moj pro */}
                <TouchableOpacity
                    style={styles.profileBtn}
                    onPress={() => router.push('/(client)/profile')}
                >
                    <Text style={styles.profileBtnText}>👤 Moj profil</Text>
                </TouchableOpacity>

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
    salonBanner: {
        margin: SPACING.lg,
        marginTop: 0,
        padding: SPACING.lg,
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.lg,
    },
    salonName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: SPACING.xs,
    },
    salonAddress: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        marginBottom: SPACING.md,
    },
    barberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: 'rgba(255,255,255,0.15)',
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
    },
    barberAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    barberAvatarText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    barberName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    barberRating: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
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
    serviceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
    serviceInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    serviceDescription: {
        fontSize: 13,
        color: COLORS.textLight,
        marginTop: 2,
    },
    serviceDuration: {
        fontSize: 12,
        color: COLORS.primary,
        marginTop: 4,
        fontWeight: '600',
    },
    servicePriceContainer: {
        alignItems: 'flex-end',
        gap: SPACING.xs,
    },
    servicePrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    serviceArrow: {
        fontSize: 18,
        color: COLORS.primary,
    },
    appointmentsBtn: {
        margin: SPACING.lg,
        marginTop: 0,
        marginBottom: SPACING.sm,
        padding: SPACING.md,
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    appointmentsBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    profileBtn: {
        margin: SPACING.lg,
        marginTop: 0,
        padding: SPACING.md,
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.primary,
        marginBottom: SPACING.xl,
    },
    profileBtnText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
});