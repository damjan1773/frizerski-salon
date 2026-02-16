import { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, SafeAreaView, ActivityIndicator, Alert
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import { formatDateLocal } from '../../lib/helpers';
import { scheduleAppointmentReminder } from '../../lib/notifications';

const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar',
    'Decembar'];
const DAYS = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];

export default function BookingScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { serviceId, serviceName, servicePrice, serviceDuration, barberId, barberName } = params;

    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [fullyBookedDates, setFullyBookedDates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [booking, setBooking] = useState(false);

    const getNext14Days = () => {
        const days = [];
        for (let i = 0; i <= 14; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            days.push(d);
        }
        return days;
    };

    const generateTimeSlots = async (date) => {
        setLoading(true);
        setSelectedSlot(null);

        try {
            const dateStr = formatDateLocal(date);

            const { data: existingAppts } = await supabase
                .from('appointments')
                .select('start_time, end_time, status')
                .eq('barber_id', barberId)
                .eq('appointment_date', dateStr);

            const slots = [];
            const duration = parseInt(serviceDuration);
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

                    const isBooked = existingAppts?.some(appt => {
                        if (appt.status === 'cancelled') return false;
                        
                        // Extract HH:mm safely
                        const apptStart = appt.start_time?.slice(0, 5);
                        const apptEnd = appt.end_time?.slice(0, 5);
                        
                        if (!apptStart || !apptEnd) return false;

                        return startStr < apptEnd && endStr > apptStart;
                    });

                    slots.push({ start: startStr, end: endStr, isBooked });
                }

                minute += 30;
                if (minute >= 60) { hour++; minute = 0; }
            }

            // Proveri da li su svi slotovi zauzeti
            const allBooked = slots.every(s => s.isBooked);
            if (allBooked) {
                setFullyBookedDates(prev => [...prev, dateStr]);
            }

            setAvailableSlots(slots);
        } catch (error) {
            console.log('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDateSelect = (date) => {
        setSelectedDate(date);
        generateTimeSlots(date);
    };

    const handleBooking = async () => {
        if (!selectedDate || !selectedSlot) {
            Alert.alert('Greška', 'Izaberite datum i vreme');
            return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profileData } = await supabase
            .from('profiles')
            .select('phone')
            .eq('id', user.id)
            .single();

        if (!profileData?.phone) {
            Alert.alert(
                'Nedostaje broj telefona',
                'Molimo dodajte broj telefona u profilu pre zakazivanja.',
                [{ text: 'OK' }]
            );
            return;
        }

        setBooking(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const dateStr = formatDateLocal(selectedDate);

            // Double check availability
            const { data: checkAppts } = await supabase
                .from('appointments')
                .select('id')
                .eq('barber_id', barberId)
                .eq('appointment_date', dateStr)
                .neq('status', 'cancelled')
                .lt('start_time', selectedSlot.end + ':00')
                .gt('end_time', selectedSlot.start + ':00');

            if (checkAppts && checkAppts.length > 0) {
                Alert.alert('Zauzeto!', 'Ovaj termin je upravo zauzet. Molimo izaberite drugi.');
                generateTimeSlots(selectedDate);
                setSelectedSlot(null);
                setBooking(false);
                return;
            }

            const { data: newAppt, error } = await supabase.from('appointments').insert({
                client_id: user.id,
                barber_id: barberId,
                service_id: serviceId,
                appointment_date: dateStr,
                start_time: selectedSlot.start + ':00',
                end_time: selectedSlot.end + ':00',
                status: 'confirmed',
            }).select().single();

            if (error) {
                if (error.code === '23505') {
                    Alert.alert('Zauzeto!', 'Neko je upravo zakazao ovaj termin. Izaberite drugi termin.');
                    generateTimeSlots(selectedDate); // refresh slotove
                    setSelectedSlot(null);
                } else {
                    throw error;
                }
                return;
            }

            if (!error && newAppt) {
                const notificationId = await scheduleAppointmentReminder(newAppt);
                if (notificationId) {
                    await supabase
                        .from('appointments')
                        .update({ notification_id: notificationId })
                        .eq('id', newAppt.id);
                }
            }

            Alert.alert(
                '✅ Termin zakazan!',
                `${serviceName} u ${selectedSlot.start}h\n${selectedDate.getDate()}. ${MONTHS[selectedDate.getMonth()]}`,
                [{ text: 'OK', onPress: () => router.replace('/(client)') }]
            );
        } catch (error) {
            Alert.alert('Greška', 'Nije moguće zakazati termin');
            console.log(error);
        } finally {
            setBooking(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>← Nazad</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Zakaži termin</Text>
                <View style={{ width: 80 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>

                {/* Izabrana usluga */}
                <View style={styles.serviceInfo}>
                    <View style={styles.serviceDetails}>
                        <Text style={styles.serviceName}>{serviceName}</Text>
                        <Text style={styles.serviceSubtitle}>✂️ {barberName} · ⏱ {serviceDuration} min</Text>
                    </View>
                    <Text style={styles.servicePrice}>{servicePrice} RSD</Text>
                </View>

                {/* Datum */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Izaberi datum</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.daysRow}>
                            {getNext14Days().map((day, index) => {
                                const isSelected = selectedDate?.toDateString() === day.toDateString();
                                const isSunday = day.getDay() === 0;
                                const dateStr = formatDateLocal(day);
                                const isFullyBooked = fullyBookedDates.includes(dateStr);
                                const isUnavailable = isSunday || isFullyBooked;

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.dayCard,
                                            isSelected && styles.dayCardActive,
                                            isUnavailable && styles.dayCardUnavailable,
                                        ]}
                                        onPress={() => !isUnavailable && handleDateSelect(day)}
                                        disabled={isUnavailable}
                                    >
                                        <Text style={[
                                            styles.dayName,
                                            isSelected && styles.dayTextActive,
                                            isUnavailable && styles.dayTextUnavailable,
                                        ]}>
                                            {DAYS[day.getDay()]}
                                        </Text>
                                        <Text style={[
                                            styles.dayNumber,
                                            isSelected && styles.dayTextActive,
                                            isUnavailable && styles.dayTextUnavailable,
                                        ]}>
                                            {day.getDate()}
                                        </Text>
                                        <Text style={[
                                            styles.dayMonth,
                                            isSelected && styles.dayTextActive,
                                            isUnavailable && styles.dayTextUnavailable,
                                        ]}>
                                            {MONTHS[day.getMonth()].slice(0, 3)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </ScrollView>
                </View>

                {/* Termini */}
                {selectedDate && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Izaberi vreme</Text>
                        {loading ? (
                            <ActivityIndicator color={COLORS.primary} />
                        ) : (
                            <View style={styles.slotsGrid}>
                                {availableSlots.map((slot, index) => {
                                    const isSelected = selectedSlot?.start === slot.start;
                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={[
                                                styles.slotCard,
                                                slot.isBooked && styles.slotBooked,
                                                isSelected && styles.slotSelected,
                                            ]}
                                            onPress={() => !slot.isBooked && setSelectedSlot(slot)}
                                            disabled={slot.isBooked}
                                        >
                                            <Text style={[
                                                styles.slotText,
                                                slot.isBooked && styles.slotTextBooked,
                                                isSelected && styles.slotTextSelected,
                                            ]}>
                                                {slot.start}
                                            </Text>

                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                )}

                {/* Potvrda */}
                {selectedSlot && (
                    <View style={styles.confirmSection}>
                        <View style={styles.confirmInfo}>
                            <Text style={styles.confirmTitle}>Potvrda rezervacije</Text>
                            <Text style={styles.confirmDetail}>📅 {selectedDate.getDate()}. {MONTHS[selectedDate.getMonth()]}</Text>
                            <Text style={styles.confirmDetail}>⏰ {selectedSlot.start} - {selectedSlot.end}</Text>
                            <Text style={styles.confirmDetail}>✂️ {serviceName}</Text>
                            <Text style={styles.confirmDetail}>💰 {servicePrice} RSD</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.bookBtn, booking && styles.bookBtnDisabled]}
                            onPress={handleBooking}
                            disabled={booking}
                        >
                            {booking
                                ? <ActivityIndicator color={COLORS.white} />
                                : <Text style={styles.bookBtnText}>Potvrdi rezervaciju</Text>
                            }
                        </TouchableOpacity>
                    </View>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    dayCardUnavailable: {
        backgroundColor: '#FFEBEE',
        borderWidth: 1.5,
        borderColor: '#FFCDD2',
    },
    dayTextUnavailable: {
        color: '#E53935',
    },
    unavailableLabel: {
        fontSize: 9,
        color: '#E53935',
        fontWeight: '700',
        marginTop: 3,
    },
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: SPACING.lg, paddingTop: SPACING.md,
        backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight,
    },
    backBtn: { padding: SPACING.xs },
    backBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
    serviceInfo: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        margin: SPACING.lg, padding: SPACING.lg, backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.lg,
    },
    serviceDetails: { flex: 1 },
    serviceName: { fontSize: 18, fontWeight: 'bold', color: COLORS.white },
    serviceSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
    servicePrice: { fontSize: 20, fontWeight: 'bold', color: COLORS.white },
    section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.md },
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
    slotsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.sm
    },
    slotCard: {
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.white,
        borderWidth: 1.5,
        borderColor: COLORS.grayLight,
        minWidth: 100,
        alignItems: 'center',
    },
    slotBooked: {
        opacity: 0.35,
        borderColor: COLORS.grayLight,
    },
    slotSelected: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary
    },
    slotText: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.text,
    },
    slotTextBooked: {
        textDecorationLine: 'line-through',
        color: COLORS.textLight,
    },
    slotTextSelected: {
        color: COLORS.white
    },
    slotBookedLabel: {
        fontSize: 10,
        color: COLORS.textLight,
        marginTop: 2,
    },
    confirmSection: { margin: SPACING.lg, marginTop: 0 },
    confirmInfo: {
        backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg, marginBottom: SPACING.md,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    },
    confirmTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.sm },
    confirmDetail: { fontSize: 14, color: COLORS.textLight, marginTop: SPACING.xs },
    bookBtn: {
        backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg, alignItems: 'center',
    },
    bookBtnDisabled: { opacity: 0.7 },
    bookBtnText: { fontSize: 17, fontWeight: 'bold', color: COLORS.white },
});