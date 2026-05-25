// services/soilService.ts

/**
 * OpenEO Ecosystem (Copernicus Data Space) Integration for Soil Moisture.
 * Instead of relying on a pre-packaged third-party API, we use openEO to run 
 * server-side processing directly on Copernicus Sentinel-1 (Radar) datasets.
 * Sentinel-1's backscatter allows for High-Resolution Surface Soil Moisture (SSM) retrieval.
 */
export async function getOpenEO_SoilMoisture(lat: number, lng: number) {
  try {
    const response = await fetch('/api/openeo/soil-moisture', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    });

    if (!response.ok) {
       console.error("openEO API request failed:", await response.text());
       
       // Fallback for simulation if missing creds locally during demo
       return {
          provider: 'openEO (Copernicus Sentinel-1)',
          resolution: '10m - 30m Radar Derived',
          updateFrequency: 'Every 2-5 days',
          estimatedMoisture: 'Moderate (derived from recent backscatter coefficient) [Simulation Mode]'
       };
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to process openEO task:", error);
    return null;
  }
}

/**
 * RCMRD GeoServer API for Regional Soil Types and pH.
 * RCMRD provides open-source, highly localized soil data mappings for Eastern Africa.
 */
export async function getRCMRDSoilData(lat: number, lng: number) {
  try {
    // We send a Spatial Query (WFS - Web Feature Service) to intersect our coordinates
    // with the regional soil polygons mapped by RCMRD.
    // Example: querying a GeoJSON feature from their workspace
    // const response = await fetch(`https://geoportal.rcmrd.org/geoserver/wfs?service=wfs&version=2.0.0&request=GetFeature&typeNames=rcmrd:soil_types&outputFormat=application/json&cql_filter=INTERSECTS(geom, POINT(${lng} ${lat}))`);
    
    // Simulating the API response for structural demonstration
    return {
      provider: 'RCMRD',
      accuracy: 'High (Localized to Kenya/East Africa)',
      soilType: 'Nitosols / Ferralsols (Typical in Kenya highlands)',
      phLevel: '5.5 - 6.5',
    };
  } catch (error) {
    console.error("Failed to fetch RCMRD data:", error);
    return null;
  }
}

/**
 * ISRIC / SoilGrids Global Fallback API
 * Used automatically when the user registers a plot outside the high-accuracy RCMRD zone.
 */
export async function getSoilGridsFallback(lat: number, lng: number) {
  try {
    const response = await fetch(`https://rest.isric.org/soilgrids/v2.0/properties/query?lat=${lat}&lon=${lng}&property=phh2o&property=soc`);
    if (!response.ok) {
      throw new Error("SoilGrids API failed");
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to fetch SoilGrids:", error);
    return null;
  }
}
