export const formatPhone = (phone) => {
    if (!phone) return 'Bez broja';
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.replace(/(\d{3})(?=\d)/g, '$1 ');
};

export const formatDateLocal = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};