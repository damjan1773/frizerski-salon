import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants/theme';

export default function ConfirmDialog({
    visible,
    title,
    message,
    confirmText = 'Da',
    cancelText = 'Odustani',
    destructive = false,
    onConfirm,
    onCancel,
}) {
    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={styles.overlay}>
                <View style={styles.box}>
                    <Text style={styles.title}>{title}</Text>
                    {message ? <Text style={styles.message}>{message}</Text> : null}
                    <View style={styles.buttons}>
                        {onCancel && (
                            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
                                <Text style={styles.cancelText}>{cancelText}</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={[styles.confirmBtn, destructive && styles.destructiveBtn]}
                            onPress={onConfirm}
                        >
                            <Text style={[styles.confirmText, destructive && styles.destructiveText]}>
                                {confirmText}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    box: {
        backgroundColor: COLORS.white,
        borderRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        width: '100%',
        maxWidth: 320,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 17,
        fontWeight: 'bold',
        color: COLORS.text,
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    message: {
        fontSize: 14,
        color: COLORS.textLight,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: SPACING.lg,
    },
    buttons: {
        flexDirection: 'row',
        gap: SPACING.sm,
        marginTop: SPACING.sm,
    },
    cancelBtn: {
        flex: 1,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        backgroundColor: COLORS.grayLight,
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.gray,
    },
    confirmBtn: {
        flex: 1,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
    },
    destructiveBtn: {
        backgroundColor: COLORS.error,
    },
    confirmText: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.white,
    },
    destructiveText: {
        color: COLORS.white,
    },
});
