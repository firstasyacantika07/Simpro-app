export const getUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
};

export const canEditMOS = (posisi) => {
    return ['Logistik', 'Admin Proyek'].includes(posisi);
};

export const canEditProgress = (posisi) => {
    return posisi === 'QS (Quantity Surveyor)';
};