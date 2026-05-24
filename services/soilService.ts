// services/soilService.ts

/**
 * OpenEPI provides open access to crop and soil data. 
 * Endpoint examples typically include bounding box or point queries for soil moisture and type.
 */
export async function getOpenEpiSoilMoisture(lat: number, lng: number) {
  try {
    // This is the structure for OpenEPI Soil API integration
    // Documented at: https://api.openepi.io/
    const response = await fetch(`https://api.openepi.io/soil/property?lat=${lat}&lon=${lng}&properties=soil_moisture`);
    
    if (!response.ok) {
      throw new Error(`OpenEPI error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch OpenEPI data:", error);
    return null;
  }
}

/**
 * RCMRD typically provides Regional Data via WMS/WFS or specific portals.
 * In a real implementation, you would query their Geoserver endpoint.
 */
export async function getRCMRDSoilData(lat: number, lng: number) {
  try {
    // Structure for RCMRD GeoServer WFS/WMS integration
    // Example: querying a GeoJSON feature from their workspace
    // const response = await fetch(`https://geoportal.rcmrd.org/geoserver/wfs?service=wfs&version=2.0.0&request=GetFeature&typeNames=rcmrd:soil_types&cql_filter=INTERSECTS(geom, POINT(${lng} ${lat}))&outputFormat=application/json`);
    
    // Simulating the API response for structural demonstration
    return {
      provider: 'RCMRD',
      accuracy: 'High (Localized)',
      soilType: 'Nitosols / Ferralsols (Typical in Kenya highlands)',
      phLevel: '5.5 - 6.5',
    };
  } catch (error) {
    console.error("Failed to fetch RCMRD data:", error);
    return null;
  }
}

/**
 * ISRIC / SoilGrids Global Fallback
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
