import { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, SafeAreaView, ActivityIndicator,
    Alert, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';

export default function ProfileScreen() {
    const [profile, setProfile] = useState(null);
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            setEmail(user.email);

            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            setProfile(data);
            setFullName(data?.full_name || '');
            setPhone(data?.phone || '');
        } catch (error) {
            console.log('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!fullName) {
            Alert.alert('Greška', 'Ime i prezime je obavezno');
            return;
        }
        if (!phone || phone.length < 9) {
            Alert.alert('Greška', 'Unesite ispravan broj telefona');
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { error } = await supabase
                .from('profiles')
                .update({ full_name: fullName, phone })
                .eq('id', user.id);

            if (error) throw error;

            Alert.alert('✅ Sačuvano!', 'Profil je uspešno ažuriran.');
        } catch (error) {
            Alert.alert('Greška', 'Nije moguće sačuvati profil');
            console.log(error);
        } finally {
            setSaving(false);
        }
    };

    const handleChangePassword = async () => {
        Alert.alert(
            'Promena lozinke',
            'Poslati email za promenu lozinke?',
            [
                { text: 'Ne', style: 'cancel' },
                {
                    text: 'Da, pošalji',
                    onPress: async () => {
                        const { error } = await supabase.auth.resetPasswordForEmail(email);
                        if (error) {
                            Alert.alert('Greška', error.message);
                        } else {
                            Alert.alert('✅ Poslato!', 'Proverite email za link za promenu lozinke.');
                        }
                    }
                }
            ]
        );
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
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Text style={styles.backBtnText}>← Nazad</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Moj profil</Text>
                    <View style={{ width: 80 }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                    {/* Avatar */}
                    <View style={styles.avatarSection}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {fullName?.charAt(0)?.toUpperCase() || '?'}
                            </Text>
                        </View>
                        <Text style={styles.avatarName}>{fullName}</Text>
                        <Text style={styles.avatarEmail}>{email}</Text>
                    </View>

                    {/* Forma */}
                    <View style={styles.form}>
                        <Text style={styles.sectionTitle}>Lični podaci</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Ime i prezime *</Text>
                            <TextInput
                                style={styles.input}
                                value={fullName}
                                onChangeText={setFullName}
                                placeholder="Marko Marković"
                                placeholderTextColor={COLORS.textLight}
                                autoCapitalize="words"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Broj telefona *</Text>
                            <TextInput
                                style={styles.input}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="065 555 333"
                                placeholderTextColor={COLORS.textLight}
                                keyboardType="number-pad"
                                returnKeyType="done"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email adresa</Text>
                            <View style={styles.inputDisabled}>
                                <Text style={styles.inputDisabledText}>{email}</Text>
                            </View>
                            <Text style={styles.inputHint}>Email se ne može menjati</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving
                                ? <ActivityIndicator color={COLORS.white} />
                                : <Text style={styles.saveBtnText}>Sačuvaj izmene</Text>
                            }
                        </TouchableOpacity>

                        {/* Promena lozinke */}
                        <View style={styles.divider} />
                        <Text style={styles.sectionTitle}>Bezbednost</Text>

                        <TouchableOpacity
                            style={styles.passwordBtn}
                            onPress={handleChangePassword}
                        >
                            <Text style={styles.passwordBtnText}>🔒 Promeni lozinku</Text>
                        </TouchableOpacity>

                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
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
    avatarSection: {
        alignItems: 'center', padding: SPACING.xl,
        backgroundColor: COLORS.white, marginBottom: SPACING.md,
    },
    avatar: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: COLORS.primary, justifyContent: 'center',
        alignItems: 'center', marginBottom: SPACING.md,
    },
    avatarText: { fontSize: 32, fontWeight: 'bold', color: COLORS.white },
    avatarName: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
    avatarEmail: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },
    form: { padding: SPACING.lg },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: SPACING.md },
    inputGroup: { marginBottom: SPACING.md },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
    input: {
        backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md, fontSize: 16, color: COLORS.text,
        borderWidth: 1, borderColor: COLORS.grayLight,
    },
    inputDisabled: {
        backgroundColor: COLORS.grayLight, borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md, borderWidth: 1, borderColor: COLORS.grayLight,
    },
    inputDisabledText: { fontSize: 16, color: COLORS.textLight },
    inputHint: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
    saveBtn: {
        backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md, alignItems: 'center', marginTop: SPACING.sm,
    },
    saveBtnDisabled: { opacity: 0.7 },
    saveBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: COLORS.grayLight, marginVertical: SPACING.lg },
    passwordBtn: {
        backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md, alignItems: 'center',
        borderWidth: 1.5, borderColor: COLORS.grayLight,
    },
    passwordBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.text },
});