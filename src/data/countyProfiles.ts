export interface CountyProfile {
  countyName: string;
  agroecologicalZone: string;
  rainfallPattern: string;
  longRainsStart: string;
  longRainsEnd: string;
  shortRainsStart: string;
  shortRainsEnd: string;
  elevationRange: string;
  dominantSoils: string;
  soilTexture: string; // e.g., Clay Loam
  droughtRisk: 'Low' | 'Medium' | 'High';
  floodRisk: 'Low' | 'Medium' | 'High';
  suitableCrops: string[];
  dominantFarmingSystem: string;
  agroforestrySpecies: string[];
  waterHarvestingPriority: 'Low' | 'Medium' | 'High';
  climateRiskNotes: string;
  centerCoordinates: { lat: number; lng: number };
}

export const COUNTY_PROFILES: Record<string, CountyProfile> = {
  'Migori': {
    countyName: 'Migori',
    agroecologicalZone: 'Lake Victoria Basin Medium-Lowlands (LM1-LM4)',
    rainfallPattern: 'Bimodal (highly reliable and moist)',
    longRainsStart: 'March',
    longRainsEnd: 'May',
    shortRainsStart: 'September',
    shortRainsEnd: 'December',
    elevationRange: '1130m - 1460m',
    dominantSoils: 'Ferralsols and Acrisols (highly leached red-orange soils)',
    soilTexture: 'Clay Loam (sandy loam on slopes)',
    droughtRisk: 'Low',
    floodRisk: 'Medium',
    suitableCrops: ['Maize', 'Sweet Potato', 'Cassava', 'Sorghum', 'Beans', 'Groundnuts', 'Kales', 'Amending Indigenous Cover Crops'],
    dominantFarmingSystem: 'Mixed smallholder cropping with livestock integration',
    agroforestrySpecies: ['Grevillea robusta', 'Markhamia lutea', 'Sesbania sesban'],
    waterHarvestingPriority: 'Medium',
    climateRiskNotes: 'Possibility of dry spells in June/July. Potential of waterlogging in valley-bottom heavy clay areas during high-intensity thunderstorms.',
    centerCoordinates: { lat: -0.97135, lng: 34.57364 } // Mariwa coordinates center
  },
  'Kisumu': {
    countyName: 'Kisumu',
    agroecologicalZone: 'Lake Victoria Cotton Zone (LM3 & LM4)',
    rainfallPattern: 'Bimodal (highly seasonal with dry spells)',
    longRainsStart: 'March',
    longRainsEnd: 'May',
    shortRainsStart: 'October',
    shortRainsEnd: 'December',
    elevationRange: '1130m - 1200m',
    dominantSoils: 'Vertisols (heavy black cotton soils prone to severe cracking)',
    soilTexture: 'Clay (extremely high clay fraction, high water storage but poor drainage)',
    droughtRisk: 'Medium',
    floodRisk: 'High',
    suitableCrops: ['Sorghum', 'Finger Millet', 'Rice', 'Cassava', 'Cowpeas', 'Early Maturing Maize', 'Groundnuts', 'Sukuma Wiki (Kales)'],
    dominantFarmingSystem: 'Dual rain-fed crop agronomy and low-density agro-pastoralism',
    agroforestrySpecies: ['Acacia polyacantha', 'Leucaena leucocephala', 'Moringa oleifera'],
    waterHarvestingPriority: 'High',
    climateRiskNotes: 'High flood frequency in the Kano Plains due to heavy drainage runoff. Soil structure gets extremely sticky and unworkable when wet, and fully compacted with vertical deep cracks when dry.',
    centerCoordinates: { lat: -0.1022, lng: 34.7617 }
  },
  'Siaya': {
    countyName: 'Siaya',
    agroecologicalZone: 'Lake Victoria Basin Transitional Zone (LM2 & LM3)',
    rainfallPattern: 'Bimodal (reliable but erratic distribution)',
    longRainsStart: 'March',
    longRainsEnd: 'May',
    shortRainsStart: 'September',
    shortRainsEnd: 'December',
    elevationRange: '1140m - 1400m',
    dominantSoils: 'Ferralsols and Gleysols (highly weathered)',
    soilTexture: 'Clay-Loam (often containing high quartz fractions or rocky gravels on ridge crests)',
    droughtRisk: 'Low',
    floodRisk: 'Low',
    suitableCrops: ['Cassava', 'Sorghum', 'Sweet Potato', 'Beans', 'Groundnuts', 'Maize', 'Finger Millet', 'Local Indigenous Greens'],
    dominantFarmingSystem: 'Cereal-legume agroecological rotation with small poultry integrations',
    agroforestrySpecies: ['Gliricidia sepium', 'Sesbania sesban', 'Cajanus cajan (Pigeon Peas)'],
    waterHarvestingPriority: 'Medium',
    climateRiskNotes: 'Frequent dry spells mid-season. Striga grass parasitical seed counts in sandy soils require consistent crop rotation with desmodium intercrops.',
    centerCoordinates: { lat: -0.0621, lng: 34.2878 }
  },
  'Trans Nzoia': {
    countyName: 'Trans Nzoia',
    agroecologicalZone: 'Upper Highland and Transitional Maize Zone (UM4)',
    rainfallPattern: 'Unimodal to Transitional (wet through most of the year)',
    longRainsStart: 'April',
    longRainsEnd: 'June',
    shortRainsStart: 'August',
    shortRainsEnd: 'November',
    elevationRange: '1800m - 2400m',
    dominantSoils: 'Deep Red Clay Nitosols (highly fertile organic mountain wash)',
    soilTexture: 'Clay Loam (ideal moisture retention capacities, high nutrient buffers)',
    droughtRisk: 'Low',
    floodRisk: 'Low',
    suitableCrops: ['Maize', 'Irish Potatoes', 'Kales/Cabbage', 'Beans', 'Wheat', 'Seedlings & Orchards', 'Rhodes Grass', 'Peas'],
    dominantFarmingSystem: 'Medium to large-scale grain production integrated with commercial dairy farming',
    agroforestrySpecies: ['Croton macrostachyus', 'Grevillea robusta', 'Calliandra calothyrsus'],
    waterHarvestingPriority: 'Low',
    climateRiskNotes: 'Relatively safe from droughts. The humid environment poses higher threats of soft rots and blight infestations during July chilly, overcast seasons.',
    centerCoordinates: { lat: 1.0189, lng: 34.9984 }
  },
  'Kakamega': {
    countyName: 'Kakamega',
    agroecologicalZone: 'Equatorial Rain-Forest Rainforest Transitional Zone (UM1-UM3)',
    rainfallPattern: 'Bimodal and Transitional (exceedingly high rainfall limits)',
    longRainsStart: 'March',
    longRainsEnd: 'June',
    shortRainsStart: 'August',
    shortRainsEnd: 'December',
    elevationRange: '1300m - 1600m',
    dominantSoils: 'Deep Humic Acrisols and Gleysols',
    soilTexture: 'Clay Loam (very rich in humic organic matter, highly resilient drainage)',
    droughtRisk: 'Low',
    floodRisk: 'Low',
    suitableCrops: ['Maize', 'Beans', 'Sweet Potatoes', 'Tea', 'Sugarcane', 'Yams', 'Cassava', 'Bananas', 'Indigenous Vegetables'],
    dominantFarmingSystem: 'Intense micro-acreage agroforestry, sugar-caning, and multi-canopy cover cropping',
    agroforestrySpecies: ['Markhamia lutea', 'Maesopsis eminii', 'Calliandra species'],
    waterHarvestingPriority: 'Low',
    climateRiskNotes: 'Extremely high and highly reliable rainfall. Primary risk is rapid depletion of soil macro-nutrients due to acid leaching on steep, un-terraced hillsides.',
    centerCoordinates: { lat: 0.2827, lng: 34.7519 }
  },
  'Machakos': {
    countyName: 'Machakos',
    agroecologicalZone: 'Semi-Arid Transition Highlands (UM4-LM5)',
    rainfallPattern: 'Bimodal (extremely short and highly variable rains)',
    longRainsStart: 'March',
    longRainsEnd: 'May',
    shortRainsStart: 'November',
    shortRainsEnd: 'December',
    elevationRange: '1000m - 1600m',
    dominantSoils: 'Luvisols and Ferralsols (low organic content)',
    soilTexture: 'Sandy Loam (very rapid drainage, prone to surface crusting/sealing)',
    droughtRisk: 'High',
    floodRisk: 'Low',
    suitableCrops: ['Cowpeas', 'Pigeon Peas', 'Green Grams', 'Sorghum', 'Finger Millet', 'Dryland Hybrid Maize', 'Cassava', 'Mangoes'],
    dominantFarmingSystem: 'Terraced conservation agro-farming with drought-hardy multi-crops',
    agroforestrySpecies: ['Melia volkensii (Mukau)', 'Acacia tortilis', 'Gliricidia sepium'],
    waterHarvestingPriority: 'High',
    climateRiskNotes: 'Erratic and highly unpredictable rainfall start-dates. Strong soil erosion risks during short high-volume storms on bare soils. Deep moisture conservation structures are vital.',
    centerCoordinates: { lat: -1.5177, lng: 37.2634 }
  },
  'Makueni': {
    countyName: 'Makueni',
    agroecologicalZone: 'Dry Semi-Arid Lowlands (LM5-LM6)',
    rainfallPattern: 'Bimodal (brief, erratic rainfall triggers)',
    longRainsStart: 'March',
    longRainsEnd: 'April',
    shortRainsStart: 'November',
    shortRainsEnd: 'December',
    elevationRange: '600m - 1100m',
    dominantSoils: 'Ferralsols and Regosols (sandy hillsides, gravels)',
    soilTexture: 'Sandy Loam (very low water-holding capacity, quick vaporization)',
    droughtRisk: 'High',
    floodRisk: 'Low',
    suitableCrops: ['Sorghum', 'Green Grams (Ndengu)', 'Cowpeas', 'Pigeon Peas', 'Cassava', 'Pearl Millet', 'Sweet Potatoes', 'Dolichos Beans'],
    dominantFarmingSystem: 'Conservation agriculture, Zai Pit reclamation, and sand-dam catchment gardening',
    agroforestrySpecies: ['Melia volkensii', 'Moringa oleifera', 'Acacia senegal', 'Azadirachta indica (Neem)'],
    waterHarvestingPriority: 'High',
    climateRiskNotes: 'Prolonged droughts lasting multiple cropping cycles. Absolute requirement for micro-basin catchments (Zai Pits), deep mulching, and planting of local drought-resilient seedbanks.',
    centerCoordinates: { lat: -1.8041, lng: 37.6203 }
  }
};

/**
 * Calculates nearest county based on geographical coordinates (haversine-approximate)
 */
export function getNearestCountyProfile(lat: number, lng: number, OSMCountyName?: string): CountyProfile {
  // If OSM reverse geocoding returns a clean name, check if it matches our list
  if (OSMCountyName) {
    const cleanOSM = OSMCountyName.toLowerCase().replace('county', '').trim();
    for (const key of Object.keys(COUNTY_PROFILES)) {
      if (cleanOSM.includes(key.toLowerCase()) || key.toLowerCase().includes(cleanOSM)) {
        return COUNTY_PROFILES[key];
      }
    }
  }

  // Nearest neighbor matching
  let minDistance = Infinity;
  let nearestKey = 'Migori'; // Default fallback

  for (const [key, profile] of Object.entries(COUNTY_PROFILES)) {
    const dLat = (profile.centerCoordinates.lat - lat) * (Math.PI / 180);
    const dLng = (profile.centerCoordinates.lng - lng) * (Math.PI / 180);
    
    // Simplistic Euclidean distance squared is fine for relative proximity
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < minDistance) {
      minDistance = distSq;
      nearestKey = key;
    }
  }

  return COUNTY_PROFILES[nearestKey];
}
