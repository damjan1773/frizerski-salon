import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { formatPhone, formatDateLocal } from '../../lib/helpers';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, ActivityIndicator,
    TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Linking
} from 'react-native';

const DAYS = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

export default function BarberDashboard() {
    const [profile, setProfile] = useState(null);
    const [barberId, setBarberId] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showAddModal, setShowAddModal] = useState(false);
    const [newAppt, setNewAppt] = useState({ clientName: '', phone: '', serviceId: '', startTime: '' });

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
                .select('id')
                .eq('profile_id', user.id)
                .single();

            if (barberData) {
                setBarberId(barberData.id);

                const { data: apptData } = await supabase
                    .from('appointments')
                    .select(`
            *,
            profiles!appointments_client_id_fkey(full_name, phone),
            services(name, duration_minutes, price)
          `)
                    .eq('barber_id', barberData.id)
                    .gte('appointment_date', formatDateLocal(new Date()))
                    .order('appointment_date', { ascending: true })
                    .order('start_time', { ascending: true });

                setAppointments(apptData || []);

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

    const getAppointmentsForDate = (date) => {
        const dateStr = formatDateLocal(date);
        return appointments.filter(a => a.appointment_date === dateStr);
    };

    const getNext14Days = () => {
        const days = [];
        for (let i = 0; i < 14; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        return days;
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

    const updateStatus = async (appointmentId, newStatus) => {
        Alert.alert(
            'Otkaži termin',
            'Da li ste sigurni da želite da otkažete ovaj termin?',
            [
                { text: 'Ne', style: 'cancel' },
                {
                    text: 'Da, otkaži',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await supabase
                            .from('appointments')
                            .update({ status: newStatus })
                            .eq('id', appointmentId);

                        if (error) {
                            Alert.alert('Greška', 'Nije moguće otkazati termin');
                            console.log(error);
                        } else {
                            fetchData();
                        }
                    }
                }
            ]
        );
    };

    const generateManualSlots = () => {
        const service = services.find(s => s.id === newAppt.serviceId);
        if (!service) return [];

        const dateStr = formatDateLocal(selectedDate);
        const existingAppts = appointments.filter(a =>
            a.appointment_date === dateStr && a.status !== 'cancelled'
        );

        const slots = [];
        const duration = service.duration_minutes;
        let hour = 9;
        let minute = 0;

        while (hour < 18) {
            const startTotal = hour * 60 + minute;
            const endTotal = startTotal + duration;

            if (endTotal <= 18 * 60) {
                const startStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                const endHour = Math.floor(endTotal / 60);
                const endMin = endTotal % 60;
                const endStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

                const isBooked = existingAppts.some(appt => {
                    const apptStart = appt.start_time.slice(0, 5);
                    const apptEnd = appt.end_time.slice(0, 5);
                    return startStr < apptEnd && endStr > apptStart;
                });

                slots.push({ start: startStr, end: endStr, isBooked });
            }

            minute += 30;
            if (minute >= 60) { hour++; minute = 0; }
        }

        return slots;
    };

    const handleAddManual = async () => {
        if (!newAppt.clientName || !newAppt.startTime || !newAppt.serviceId) {
            Alert.alert('Greška', 'Popunite ime, vreme i uslugu');
            return;
        }

        const service = services.find(s => s.id === newAppt.serviceId);
        const dateStr = formatDateLocal(selectedDate);
        const startTime = newAppt.startTime + ':00';
        const [h, m] = newAppt.startTime.split(':').map(Number);
        const endTotal = h * 60 + m + service.duration_minutes;
        const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}:00`;

        try {
            const { data: { user } } = await supabase.auth.getUser();

            await supabase.from('appointments').insert({
                client_id: user.id,
                barber_id: barberId,
                service_id: newAppt.serviceId,
                appointment_date: dateStr,
                start_time: startTime,
                end_time: endTime,
                status: 'confirmed',
                notes: `Telefonska rezervacija — ${newAppt.clientName}${newAppt.phone ? ', ' + newAppt.phone : ''}`,
            });

            setShowAddModal(false);
            setNewAppt({ clientName: '', phone: '', serviceId: '', startTime: '' });
            fetchData();
            Alert.alert('✅ Dodato!', `Termin za ${newAppt.clientName} u ${newAppt.startTime}h`);
        } catch (error) {
            Alert.alert('Greška', 'Nije moguće dodati termin');
            console.log(error);
        }
    };

    const selectedAppointments = getAppointmentsForDate(selectedDate);

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
                        <Text style={styles.greeting}>✂️ {profile?.full_name}</Text>
                        <Text style={styles.subtitle}>Tvoj raspored</Text>
                    </View>
                    <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
                        <Text style={styles.logoutText}>Odjavi se</Text>
                    </TouchableOpacity>
                </View>

                {/* Stats */}
                {/* Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>
                            {appointments.filter(a =>
                                a.appointment_date === formatDateLocal(new Date()) &&
                                a.status !== 'cancelled'
                            ).length}
                        </Text>
                        <Text style={styles.statLabel}>Danas</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>
                            {appointments.filter(a => {
                                const tomorrow = new Date();
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                return a.appointment_date === formatDateLocal(tomorrow) &&
                                    a.status !== 'cancelled';
                            }).length}
                        </Text>
                        <Text style={styles.statLabel}>Sutra</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>
                            {appointments.filter(a => a.status !== 'cancelled').length}
                        </Text>
                        <Text style={styles.statLabel}>Ova nedelja</Text>
                    </View>
                </View>

                {/* Kalendar */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Izaberi dan</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.daysRow}>
                            {getNext14Days().map((day, index) => {
                                const isSelected = day.toDateString() === selectedDate.toDateString();
                                const isSunday = day.getDay() === 0;
                                const hasAppts = getAppointmentsForDate(day).filter(a => a.status !== 'cancelled').length > 0;
                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.dayCard,
                                            isSelected && styles.dayCardActive,
                                            isSunday && styles.dayCardUnavailable,
                                        ]}
                                        onPress={() => !isSunday && setSelectedDate(day)}
                                        disabled={isSunday}
                                    >
                                        <Text style={[styles.dayName, isSelected && styles.dayTextActive, isSunday && styles.dayTextUnavailable]}>
                                            {DAYS[day.getDay()]}
                                        </Text>
                                        <Text style={[styles.dayNumber, isSelected && styles.dayTextActive, isSunday && styles.dayTextUnavailable]}>
                                            {day.getDate()}
                                        </Text>
                                        <Text style={[styles.dayMonth, isSelected && styles.dayTextActive, isSunday && styles.dayTextUnavailable]}>
                                            {MONTHS[day.getMonth()]}
                                        </Text>
                                        {hasAppts && !isSunday && (
                                            <View style={[styles.dot, isSelected && styles.dotActive]} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>

                {/* Termini */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>
                            Termini — {selectedDate.getDate()}. {MONTHS[selectedDate.getMonth()]}
                        </Text>
                        <TouchableOpacity
                            style={styles.addBtn}
                            onPress={() => setShowAddModal(true)}
                        >
                            <Text style={styles.addBtnText}>+ Dodaj</Text>
                        </TouchableOpacity>
                    </View>

                    {selectedAppointments.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📅</Text>
                            <Text style={styles.emptyText}>Nema termina za ovaj dan</Text>
                        </View>
                    ) : (
                        selectedAppointments.map((appt) => (
                            <View key={appt.id} style={[
                                styles.apptCard,
                                appt.status === 'cancelled' && styles.apptCardCancelled,
                                appt.status === 'completed' && styles.apptCardCompleted,
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
                                {appt.status === 'confirmed' && (
                                    <View style={styles.apptActions}>
                                        <TouchableOpacity
                                            style={styles.callBtn}
                                            onPress={() => {
                                                const phone = appt.notes?.startsWith('Telefonska')
                                                    ? appt.notes.split(',')[1]?.trim()
                                                    : appt.profiles?.phone;
                                                if (phone) {
                                                    Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
                                                } else {
                                                    Alert.alert('Nema broja', 'Klijent nije uneo broj telefona');
                                                }
                                            }}
                                        >
                                            <Text style={styles.callBtnText}>📞</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.cancelBtn}
                                            onPress={() => updateStatus(appt.id, 'cancelled')}
                                        >
                                            <Text style={styles.cancelBtnText}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        ))
                    )}
                </View>

            </ScrollView>

            {/* Modal za dodavanje */}
            <Modal visible={showAddModal} transparent animationType="slide">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalContent}>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Text style={styles.modalTitle}>Dodaj termin ručno</Text>
                            <Text style={styles.modalSubtitle}>
                                {selectedDate.getDate()}. {MONTHS[selectedDate.getMonth()]}
                            </Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Ime klijenta</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Marko Marković"
                                    value={newAppt.clientName}
                                    onChangeText={v => setNewAppt({ ...newAppt, clientName: v })}
                                    autoCapitalize="words"
                                    returnKeyType="next"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Telefon</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="065 555 333"
                                    value={newAppt.phone}
                                    onChangeText={v => setNewAppt({ ...newAppt, phone: v })}
                                    returnKeyType="done"
                                    blurOnSubmit={true}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Usluga</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.serviceRow}>
                                        {services.map(s => (
                                            <TouchableOpacity
                                                key={s.id}
                                                style={[styles.serviceChip, newAppt.serviceId === s.id && styles.serviceChipActive]}
                                                onPress={() => setNewAppt({ ...newAppt, serviceId: s.id })}
                                            >
                                                <Text style={[styles.serviceChipText, newAppt.serviceId === s.id && styles.serviceChipTextActive]}>
                                                    {s.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Vreme</Text>
                                {!newAppt.serviceId ? (
                                    <Text style={styles.selectServiceFirst}>Prvo izaberi uslugu</Text>
                                ) : (
                                    <View style={styles.timeSlotsGrid}>
                                        {generateManualSlots().map((slot, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={[
                                                    styles.timeSlotChip,
                                                    slot.isBooked && styles.timeSlotBooked,
                                                    newAppt.startTime === slot.start && styles.timeSlotActive,
                                                ]}
                                                onPress={() => !slot.isBooked && setNewAppt({ ...newAppt, startTime: slot.start })}
                                                disabled={slot.isBooked}
                                            >
                                                <Text style={[
                                                    styles.timeSlotText,
                                                    slot.isBooked && styles.timeSlotTextBooked,
                                                    newAppt.startTime === slot.start && styles.timeSlotTextActive,
                                                ]}>
                                                    {slot.start}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.modalCancelBtn}
                                    onPress={() => {
                                        setShowAddModal(false);
                                        setNewAppt({ clientName: '', phone: '', serviceId: '', startTime: '' });
                                    }}
                                >
                                    <Text style={styles.modalCancelText}>Otkaži</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalConfirmBtn}
                                    onPress={handleAddManual}
                                >
                                    <Text style={styles.modalConfirmText}>Dodaj termin</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', padding: SPACING.lg, paddingTop: SPACING.md,
    },
    greeting: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
    subtitle: { fontSize: 14, color: COLORS.textLight, marginTop: 2 },
    logoutBtn: { padding: SPACING.sm, borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.grayLight },
    logoutText: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
    statsRow: { flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
    statCard: {
        flex: 1, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md, alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    statNumber: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary },
    statLabel: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    section: { padding: SPACING.lg, paddingTop: 0, marginBottom: SPACING.sm },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: SPACING.md
    },
    addBtn: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: BORDER_RADIUS.full },
    addBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 14 },
    daysRow: { flexDirection: 'row', gap: SPACING.sm },
    dayCard: {
        alignItems: 'center', padding: SPACING.sm, paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.lg, backgroundColor: COLORS.white, minWidth: 64,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    dayCardActive: { backgroundColor: COLORS.primary },
    dayName: { fontSize: 12, color: COLORS.textLight, fontWeight: '600' },
    dayNumber: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginVertical: 2 },
    dayMonth: { fontSize: 11, color: COLORS.textLight },
    dayTextActive: { color: COLORS.white },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, marginTop: 4 },
    dotActive: { backgroundColor: COLORS.white },
    emptyState: { alignItems: 'center', padding: SPACING.xxl, backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg },
    emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
    emptyText: { fontSize: 16, color: COLORS.textLight },
    apptCard: {
        flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm, alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    apptCardCancelled: { opacity: 0.5 },
    apptCardCompleted: { opacity: 0.7 },
    apptTime: { alignItems: 'center', marginRight: SPACING.md, minWidth: 48 },
    apptTimeText: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
    apptTimeEnd: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    textFaded: { color: COLORS.textLight },
    apptInfo: { flex: 1 },
    apptClient: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
    apptService: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
    apptPhone: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    statusBadge: { alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: BORDER_RADIUS.full, marginTop: SPACING.xs },
    statusText: { fontSize: 11, fontWeight: '700' },
    apptActions: {
        gap: SPACING.xs,
        alignItems: 'center',
        jusitfyContent: 'center',
    },
    doneBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
    doneBtnText: { fontSize: 16, color: '#28A745', fontWeight: 'bold' },
    cancelBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFEBEE', justifyContent: 'center', alignItems: 'center' },
    cancelBtnText: { fontSize: 16, color: '#DC3545', fontWeight: 'bold' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, paddingBottom: 40 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
    modalSubtitle: { fontSize: 14, color: COLORS.textLight, marginBottom: SPACING.lg },
    inputGroup: { marginBottom: SPACING.md },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
    input: { backgroundColor: COLORS.grayLight, borderRadius: BORDER_RADIUS.md, padding: SPACING.md, fontSize: 16, color: COLORS.text },
    serviceRow: { flexDirection: 'row', gap: SPACING.sm },
    serviceChip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: BORDER_RADIUS.full, backgroundColor: COLORS.grayLight, borderWidth: 1.5, borderColor: COLORS.grayLight },
    serviceChipActive: { backgroundColor: COLORS.primary + '20', borderColor: COLORS.primary },
    serviceChipText: { fontSize: 14, color: COLORS.gray, fontWeight: '600' },
    serviceChipTextActive: { color: COLORS.primary },
    modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
    modalCancelBtn: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, backgroundColor: COLORS.grayLight, alignItems: 'center' },
    modalCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.gray },
    modalConfirmBtn: { flex: 1, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, backgroundColor: COLORS.primary, alignItems: 'center' },
    modalConfirmText: { fontSize: 15, fontWeight: '600', color: COLORS.white },
    selectServiceFirst: {
        fontSize: 14, color: COLORS.textLight,
        fontStyle: 'italic', padding: SPACING.sm
    },
    timeSlotsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm
    },
    timeSlotChip: {
        paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.white,
        borderWidth: 1.5, borderColor: COLORS.grayLight, minWidth: 70,
        alignItems: 'center',
    },
    timeSlotBooked: {
        opacity: 0.35, backgroundColor: COLORS.grayLight
    },
    timeSlotActive: {
        backgroundColor: COLORS.primary, borderColor: COLORS.primary
    },
    timeSlotText: {
        fontSize: 15, fontWeight: '600', color: COLORS.text
    },
    timeSlotTextBooked: {
        textDecorationLine: 'line-through', color: COLORS.textLight
    },
    timeSlotTextActive: {
        color: COLORS.white
    },
    dayCardUnavailable: {
        backgroundColor: '#FFEBEE',
        borderWidth: 1.5,
        borderColor: '#FFCDD2',
    },
    dayTextUnavailable: {
        color: '#E53935',
    },
});