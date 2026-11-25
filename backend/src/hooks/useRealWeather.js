import { useState, useEffect, useCallback } from 'react';

// Default koordinat: Kab. Madiun / Desa Wonorejo, Jawa Timur
const DEFAULT_COORDS = {
    latitude: -7.5718,
    longitude: 111.6531,
    locationName: 'Kab. Madiun',
};

const mapWeatherCode = (code) => {
    if (code === 0) return { label: 'Cerah', type: 'clear' };
    if (code === 1 || code === 2) return { label: 'Cerah Berawan', type: 'partly-cloudy' };
    if (code === 3) return { label: 'Berawan / Mendung', type: 'cloudy' };
    if (code === 45 || code === 48) return { label: 'Berkabut', type: 'cloudy' };
    if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Gerimis', type: 'rain' };
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Hujan', type: 'rain' };
    if ([95, 96, 99].includes(code)) return { label: 'Hujan Petir', type: 'storm' };
    return { label: 'Berawan', type: 'partly-cloudy' };
};

export function useRealWeather(customCoords = null) {
    const [weather, setWeather] = useState({
        loading: true,
        error: null,
        temp: '--',
        condition: 'Memuat cuaca...',
        type: 'partly-cloudy',
        humidity: '--',
        windSpeed: '--',
        rainChance: '--',
        locationName: customCoords?.locationName || DEFAULT_COORDS.locationName,
    });

    const fetchWeather = useCallback(async (lat, lon, locName) => {
        try {
            const url =
                `https://api.open-meteo.com/v1/forecast` +
                `?latitude=${lat}&longitude=${lon}` +
                `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
                `&hourly=precipitation_probability` +
                `&forecast_days=1&timezone=auto`;

            const res = await fetch(url);
            if (!res.ok) throw new Error('Gagal mengambil data cuaca');
            const data = await res.json();

            const current = data?.current || {};
            const mapped = mapWeatherCode(current.weather_code);

            // Ambil peluang hujan pada jam saat ini
            const currentHourPrefix = String(current.time || '').slice(0, 13);
            const hourlyTimes = data?.hourly?.time || [];
            const hourlyProbs = data?.hourly?.precipitation_probability || [];
            const hourIdx = hourlyTimes.findIndex((t) => String(t).startsWith(currentHourPrefix));
            const rainProb =
                hourIdx !== -1 && hourlyProbs[hourIdx] != null
                    ? hourlyProbs[hourIdx]
                    : hourlyProbs[0] ?? 0;

            setWeather({
                loading: false,
                error: null,
                temp: current.temperature_2m != null ? Math.round(current.temperature_2m) : '--',
                condition: mapped.label,
                type: mapped.type,
                humidity: current.relative_humidity_2m != null ? Math.round(current.relative_humidity_2m) : '--',
                windSpeed: current.wind_speed_10m != null ? Math.round(current.wind_speed_10m) : '--',
                rainChance: Math.round(rainProb),
                locationName: locName,
            });
        } catch (err) {
            setWeather((prev) => ({
                ...prev,
                loading: false,
                error: err.message || 'Gagal memuat cuaca',
                condition: prev.temp === '--' ? 'Gagal memuat' : prev.condition,
            }));
        }
    }, []);

    useEffect(() => {
        if (customCoords?.latitude && customCoords?.longitude) {
            fetchWeather(
                customCoords.latitude,
                customCoords.longitude,
                customCoords.locationName || DEFAULT_COORDS.locationName
            );
            return;
        }

        // Ambil cuaca default terlebih dahulu agar cepat tampil
        fetchWeather(DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude, DEFAULT_COORDS.locationName);

        // Perbarui dengan GPS perangkat jika pengguna mengizinkan
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    fetchWeather(
                        pos.coords.latitude,
                        pos.coords.longitude,
                        'Lokasi Saat Ini'
                    );
                },
                () => {
                    // Tetap gunakan koordinat default jika ditolak/gagal
                },
                { timeout: 6000 }
            );
        }

        // Auto-refresh setiap 15 menit
        const interval = setInterval(() => {
            fetchWeather(DEFAULT_COORDS.latitude, DEFAULT_COORDS.longitude, DEFAULT_COORDS.locationName);
        }, 15 * 60 * 1000);

        return () => clearInterval(interval);
    }, [customCoords?.latitude, customCoords?.longitude, customCoords?.locationName, fetchWeather]);

    return weather;
}