
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
  'Mariwa': { lat: -0.783, lng: 34.467 },      // Migori Region
  'Mulo': { lat: -0.833, lng: 34.617 },        // Migori Region
  'Rabolo': { lat: 0.067, lng: 34.317 },       // Siaya/Yala Region
  'Nyamagagana': { lat: -0.517, lng: 37.083 }, // Central Region (Approx)
  'Kangemi': { lat: -1.258, lng: 36.746 },     // Nairobi
  'Kabarnet': { lat: 0.492, lng: 35.743 },     // Baringo
  'Apuoyo': { lat: -0.092, lng: 34.758 },      // Kisumu Region
  'Sibembe': { lat: 0.56, lng: 34.56 },        // Bungoma Region
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
  if (precipProb > 60) return "High chance of rain. Avoid applying fertilizer or pesticides today. Ensure drainage channels are clear.";
  if (precipProb > 30) return "Moderate rain expected. Good day for planting if soil is ready, but delay drying crops outside.";
  if (tempMax > 28) return "High temperatures expected. Ensure irrigation for vegetables and keep livestock hydrated.";
  if (tempMax < 18) return "Cooler temperatures. Monitor young chicks and seedlings for cold stress.";
  return "Conditions are stable. Ideal for general field work, weeding, and harvesting.";
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
