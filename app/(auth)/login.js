import { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, BORDER_RADIUS } from '../../constants/theme';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { AntDesign } from '@expo/vector-icons';
import { registerForPushNotifications } from '../../lib/notifications';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const [rememberMe, setRememberMe] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Greška', 'Unesite email i lozinku');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);

        if (error) {
            Alert.alert('Greška pri prijavi', error.message);
        } else {
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.id) {
                registerForPushNotifications(user.id);
            }
        }
    };

    const handleGoogleLogin = async () => {
        try {
            const redirectUrl = AuthSession.makeRedirectUri({
                scheme: 'frizerski-salon',
                path: 'auth/callback',
            });

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                },
            });

            if (error) throw error;

            const result = await WebBrowser.openAuthSessionAsync(
                data?.url,
                redirectUrl
            );

            if (result.type === 'success') {
                const url = result.url;
                const params = new URLSearchParams(url.split('#')[1]);
                const accessToken = params.get('access_token');
                const refreshToken = params.get('refresh_token');

                if (accessToken) {
                    await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                }
            }
        } catch (error) {
            Alert.alert('Greška', 'Google prijava nije uspela');
            console.log(error);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.logo}>✂️</Text>
                    <Text style={styles.title}>Frizerski salon</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Email adresa</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="vas@email.com"
                            placeholderTextColor={COLORS.textLight}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Lozinka</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="••••••••"
                            placeholderTextColor={COLORS.textLight}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.rememberRow}
                        onPress={() => setRememberMe(!rememberMe)}
                    >
                        <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                            {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                        </View>
                        <Text style={styles.rememberText}>Zapamti me</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color={COLORS.white} />
                            : <Text style={styles.buttonText}>Prijavi se</Text>
                        }
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={() => router.push('/(auth)/register')}
                    >
                        <Text style={styles.linkText}>
                            Nemate nalog? <Text style={styles.linkTextBold}>Registrujte se</Text>
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.googleBtn}
                        onPress={handleGoogleLogin}
                    >
                        <View style={styles.googleBtnInner}>
                            <AntDesign name="google" size={18} color="#DB4437" />
                            <Text style={styles.googleBtnText}>Nastavi sa Google nalogom</Text>
                        </View>
                    </TouchableOpacity>

                    {/* DEV ONLY - obrisi pre launcha */}
                    <View style={styles.devButtons}>
                        <Text style={styles.devLabel}>TEST NALOZI</Text>
                        <View style={styles.devRow}>
                            <TouchableOpacity
                                style={styles.devBtn}
                                onPress={() => {
                                    setEmail('frizer@gmail.com');
                                    setPassword('frizer123');
                                }}
                            >
                                <Text style={styles.devBtnText}>Frizer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.devBtn}
                                onPress={() => {
                                    setEmail('dodicdamjan@gmail.com');
                                    setPassword('jasamdamjan');
                                }}
                            >
                                <Text style={styles.devBtnText}>Klijent</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: SPACING.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xxl,
    },
    logo: {
        fontSize: 64,
        marginBottom: SPACING.sm,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.textLight,
    },
    form: {
        gap: SPACING.md,
    },
    inputGroup: {
        gap: SPACING.xs,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
    },
    input: {
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        fontSize: 16,
        color: COLORS.text,
        borderWidth: 1,
        borderColor: COLORS.grayLight,
    },
    button: {
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        alignItems: 'center',
        marginTop: SPACING.sm,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: 'bold',
    },
    linkButton: {
        alignItems: 'center',
        marginTop: SPACING.sm,
    },
    linkText: {
        fontSize: 14,
        color: COLORS.textLight,
    },
    linkTextBold: {
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    rememberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.grayLight,
        backgroundColor: COLORS.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    checkmark: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: 'bold',
    },
    rememberText: {
        fontSize: 14,
        color: COLORS.text,
    },
    devButtons: {
        marginTop: SPACING.xl,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.grayLight,
        borderStyle: 'dashed',
    },
    devLabel: {
        fontSize: 11,
        color: COLORS.textLight,
        textAlign: 'center',
        marginBottom: SPACING.sm,
        fontWeight: '600',
        letterSpacing: 1,
    },
    devRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    devBtn: {
        flex: 1,
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.grayLight,
        alignItems: 'center',
    },
    devBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.gray,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginVertical: SPACING.sm,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.grayLight,
    },
    dividerText: {
        fontSize: 13,
        color: COLORS.textLight,
    },
    googleBtn: {
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        borderWidth: 1.5,
        borderColor: COLORS.grayLight,
    },
    googleBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    googleBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
    },
});