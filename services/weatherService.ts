export interface WeatherData {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    weathercode: number[];
  };
  current_weather: {
    temperature: number;
    weathercode: number;
    windspeed: number;
  };
}

export const CLUSTER_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'Mariwa': { lat: -0.97135, lng: 34.57364 },      // Migori County
  'Mulo': { lat: -0.95156, lng: 34.59694 },        // Migori County
  'Rabolo': { lat: -0.86146, lng: 34.56653 },      // Ranen, Migori County
  'Nyamagagana': { lat: -1.130265, lng: 34.571417 }, // Kuria West, Migori County
  'Kangemi': { lat: -1.269275, lng: 36.744238 },   // Nairobi County
  'Kabarnet': { lat: 0.4940, lng: 35.7440 },       // Baringo County
  'Apuoyo': { lat: -0.003066, lng: 34.396335 },    // Siaya County
  'Sibembe': { lat: 0.84019, lng: 34.86705 },      // Sikhendu, Trans-Nzoia County
};

// WMO Weather interpretation
export const getWeatherDescription = (code: number): { label: string; icon: string; color: string } => {
  if (code === 0) return { label: 'Clear Sky', icon: 'fa-sun', color: 'text-yellow-500' };
  if (code >= 1 && code <= 3) return { label: 'Partly Cloudy', icon: 'fa-cloud-sun', color: 'text-blue-400' };
  if (code >= 45 && code <= 48) return { label: 'Foggy', icon: 'fa-smog', color: 'text-slate-500' };
  if (code >= 51 && code <= 55) return { label: 'Drizzle', icon: 'fa-cloud-rain', color: 'text-blue-300' };
  if (code >= 61 && code <= 65) return { label: 'Rain', icon: 'fa-umbrella', color: 'text-blue-600' };
  if (code >= 80 && code <= 82) return { label: 'Showers', icon: 'fa-cloud-showers-heavy', color: 'text-blue-700' };
  if (code >= 95) return { label: 'Thunderstorm', icon: 'fa-bolt', color: 'text-purple-600' };
  return { label: 'Overcast', icon: 'fa-cloud', color: 'text-slate-400' };
};

export const getAgroAdvice = (precipProb: number, tempMax: number): string => {
  if (precipProb > 60) return "High chance of heavy rain. Avoid applying manure or organic sprays today as they may wash away. Ensure field drainage channels are clear to prevent waterlogging. Good time to harvest rainwater.";
  if (precipProb > 30) return "Moderate rain expected. Excellent conditions for planting seeds and transplanting seedlings if the soil is prepared. Delay sun-drying harvested crops outside to prevent mold.";
  if (tempMax > 28) return "High temperatures expected. Prioritize early morning or late evening irrigation for vegetables to reduce evaporation. Provide ample shade and clean drinking water for livestock and poultry.";
  if (tempMax < 18) return "Cooler temperatures expected. Monitor young chicks and delicate seedlings for cold stress. Consider mulching around plant bases to retain soil warmth and moisture.";
  return "Conditions are stable and favorable. Ideal weather for general field work, weeding, preparing compost, and applying well-rotted manure to your plots. Safe for harvesting and sun-drying crops.";
};

export const fetchWeather = async (cluster: string): Promise<WeatherData | null> => {
  const coords = CLUSTER_COORDINATES[cluster] || CLUSTER_COORDINATES['Mariwa'];
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&current_weather=true&timezone=Africa%2FNairobi`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Weather fetch failed');
    const data = await response.json();
    
    // Cache for offline use
    localStorage.setItem(`weather_cache_${cluster}`, JSON.stringify({
      timestamp: Date.now(),
      data
    }));
    
    return data;
  } catch (err) {
    // Suppress error log for expected network failures in offline/restricted environments
    console.warn("Weather API unavailable (using fallback):", err instanceof Error ? err.message : String(err));
    
    // Try retrieving from cache
    const cached = localStorage.getItem(`weather_cache_${cluster}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Valid for 24 hours
      if (Date.now() - parsed.timestamp < 86400000) {
        return parsed.data;
      }
    }

    // Fallback to Mock Data if API and Cache fail
    console.warn("Weather API unreachable, using fallback data.");
    return {
      daily: {
        time: Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          return d.toISOString().split('T')[0];
        }),
        temperature_2m_max: [25, 26, 24, 23, 25, 27, 26],
        temperature_2m_min: [16, 17, 15, 15, 16, 17, 16],
        precipitation_probability_max: [30, 40, 60, 20, 10, 5, 10],
        weathercode: [2, 3, 61, 1, 0, 0, 1]
      },
      current_weather: {
        temperature: 22,
        weathercode: 2,
        windspeed: 10
      }
    };
  }
};
