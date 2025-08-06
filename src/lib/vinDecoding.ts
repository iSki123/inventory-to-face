// NHTSA VIN Decoding API integration
export interface NHTSAVinResponse {
  Make?: string;
  Model?: string;
  ModelYear?: string;
  BodyClass?: string;
  FuelTypePrimary?: string;
  TransmissionStyle?: string;
  EngineHP?: string;
  EngineCylinders?: string;
  DisplacementL?: string;
  VehicleType?: string;
  DriveType?: string;
  ErrorCode?: string;
  ErrorText?: string;
}

export interface VinDecodingResult {
  body_style_nhtsa?: string;
  fuel_type_nhtsa?: string;
  transmission_nhtsa?: string;
  engine_nhtsa?: string;
  vehicle_type_nhtsa?: string;
  drivetrain_nhtsa?: string;
  vin_decoded_at: string;
  success: boolean;
  error?: string;
}

export async function decodeVin(vin: string): Promise<VinDecodingResult> {
  const now = new Date().toISOString();
  
  if (!vin || vin.length !== 17) {
    return {
      success: false,
      error: 'Invalid VIN format',
      vin_decoded_at: now
    };
  }

  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValues/${vin}?format=json`
    );

    if (!response.ok) {
      return {
        success: false,
        error: `NHTSA API error: ${response.status}`,
        vin_decoded_at: now
      };
    }

    const data = await response.json();
    const vinData: NHTSAVinResponse = data.Results?.[0] || {};

    if (vinData.ErrorCode && vinData.ErrorCode !== '0') {
      return {
        success: false,
        error: vinData.ErrorText || 'VIN decoding failed',
        vin_decoded_at: now
      };
    }

    // Build engine description from available data
    let engineDesc = '';
    if (vinData.EngineCylinders) {
      engineDesc += `${vinData.EngineCylinders} Cylinder`;
    }
    if (vinData.DisplacementL) {
      engineDesc += engineDesc ? ` ${vinData.DisplacementL}L` : `${vinData.DisplacementL}L`;
    }
    if (vinData.EngineHP) {
      engineDesc += engineDesc ? ` ${vinData.EngineHP}HP` : `${vinData.EngineHP}HP`;
    }

    return {
      body_style_nhtsa: vinData.BodyClass || undefined,
      fuel_type_nhtsa: vinData.FuelTypePrimary || undefined,
      transmission_nhtsa: vinData.TransmissionStyle || undefined,
      engine_nhtsa: engineDesc || undefined,
      vehicle_type_nhtsa: vinData.VehicleType || undefined,
      drivetrain_nhtsa: vinData.DriveType || undefined,
      vin_decoded_at: now,
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      vin_decoded_at: now
    };
  }
}

// Fallback mappings for common NHTSA values to our internal format
export function mapNHTSAToInternal(nhtsa: string, field: 'fuel_type' | 'transmission' | 'drivetrain'): string {
  const mappings = {
    fuel_type: {
      'Gasoline': 'gasoline',
      'Diesel': 'diesel',
      'Electric': 'electric',
      'Hybrid': 'hybrid',
      'E85': 'gasoline',
      'CNG': 'gasoline'
    },
    transmission: {
      'Manual': 'manual',
      'Automatic': 'automatic',
      'CVT': 'automatic',
      'Semi-Automatic': 'automatic'
    },
    drivetrain: {
      'Front-Wheel Drive': 'fwd',
      'Rear-Wheel Drive': 'rwd',
      'All-Wheel Drive': 'awd',
      '4WD': 'awd',
      'AWD': 'awd'
    }
  };

  return mappings[field][nhtsa as keyof typeof mappings[typeof field]] || nhtsa.toLowerCase();
}