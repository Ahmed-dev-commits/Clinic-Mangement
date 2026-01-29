
export const THEME_PRESETS = [
    { name: 'Blue', value: '221 83% 53%', hex: '#3b82f6' },
    { name: 'Green', value: '142 76% 36%', hex: '#16a34a' },
    { name: 'Purple', value: '262 83% 58%', hex: '#9333ea' },
    { name: 'Red', value: '0 84% 60%', hex: '#dc2626' },
    { name: 'Orange', value: '24 95% 53%', hex: '#f97316' },
    { name: 'Teal', value: '175 84% 32%', hex: '#0d9488' },
];

export const applyTheme = (hslValue: string) => {
    const root = document.documentElement;
    root.style.setProperty('--primary', hslValue);
    root.style.setProperty('--ring', hslValue);
    // Also update sidebar primary if we want it to match
    root.style.setProperty('--sidebar-primary', hslValue);
};
