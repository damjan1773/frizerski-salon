import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export async function registerForPushNotifications(userId) {
    if (!Device.isDevice) return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('appointments', {
            name: 'Termini',
            importance: Notifications.AndroidImportance.HIGH,
            sound: true,
        });
    }
}

export async function scheduleAppointmentReminder(appointment) {
    const [year, month, day] = appointment.appointment_date.split('-').map(Number);
    const [hour, minute] = appointment.start_time.split(':').map(Number);

    const appointmentDate = new Date(year, month - 1, day, hour, minute, 0);
    const reminderDate = new Date(appointmentDate.getTime() - 60 * 60 * 1000);

    if (reminderDate <= new Date()) return null;

    try {
        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title: '✂️ Podsetnik za termin',
                body: `Vaš termin je za sat vremena (${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}h)`,
                sound: true,
            },
            trigger: {
                type: 'date',
                date: reminderDate,
                channelId: 'appointments',
            },
        });

        return notificationId;
    } catch (error) {
        return null;
    }
}

export async function cancelAppointmentReminder(notificationId) {
    if (!notificationId) return;
    await Notifications.cancelScheduledNotificationAsync(notificationId);
}