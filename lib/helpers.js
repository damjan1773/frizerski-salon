export const formatPhone = (phone) => {
    if (!phone) return 'Bez broja';

    const cleaned = phone.replace(/\D/g, '');

    return cleaned.replace(/(\d{3})(?=\d)/g, '$1 ');
};

export const formatDateLocal = (date) => {
    const d = new Date(date);
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
};