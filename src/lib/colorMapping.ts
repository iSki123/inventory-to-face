// Color mapping utility for standardizing vehicle colors to Facebook Marketplace approved list
export const FACEBOOK_MARKETPLACE_COLORS = [
  'Black', 'Blue', 'Brown', 'Gold', 'Green', 'Gray', 'Pink', 'Purple', 
  'Red', 'Silver', 'Orange', 'White', 'Yellow', 'Charcoal', 'Off white', 
  'Tan', 'Beige', 'Burgundy'
] as const;

export type StandardizedColor = typeof FACEBOOK_MARKETPLACE_COLORS[number];

// Keyword mapping for exterior color normalization
const COLOR_KEYWORD_MAP: Record<string, StandardizedColor | null> = {
  'silver': 'Silver',
  'gray': 'Gray',
  'grey': 'Gray',
  'blue': 'Blue',
  'black': 'Black',
  'white': 'White',
  'pearl': 'White',
  'red': 'Red',
  'green': 'Green',
  'gold': 'Gold',
  'brown': 'Brown',
  'beige': 'Beige',
  'tan': 'Tan',
  'charcoal': 'Charcoal',
  'burgundy': 'Burgundy',
  'orange': 'Orange',
  'yellow': 'Yellow',
  'pink': 'Pink',
  'purple': 'Purple',
  'cream': 'Off white',
  'ivory': 'Off white',
  'champagne': 'Beige',
  'bronze': 'Brown',
  'copper': 'Brown',
  'maroon': 'Burgundy',
  'wine': 'Burgundy',
  'crimson': 'Red',
  'ruby': 'Red',
  'azure': 'Blue',
  'navy': 'Blue',
  'teal': 'Green',
  'lime': 'Green',
  'olive': 'Green',
  'forest': 'Green',
  'slate': 'Gray',
  'gunmetal': 'Charcoal',
  'graphite': 'Charcoal',
  'platinum': 'Silver',
  'titanium': 'Silver',
  'aluminum': 'Silver',
  'metallic': null, // Will use base color
  'clearcoat': null, // Will use base color
  'mica': null, // Will use base color
  'pearlcoat': 'White'
};

/**
 * Standardizes exterior color to Facebook Marketplace approved colors
 * @param rawColor - Original color string from vehicle data
 * @returns Standardized color or 'Unknown' if no match found
 */
export function standardizeExteriorColor(rawColor?: string): string {
  if (!rawColor) return 'Unknown';

  const normalizedInput = rawColor.toLowerCase().trim();
  
  // Check for direct matches first
  for (const [keyword, standardColor] of Object.entries(COLOR_KEYWORD_MAP)) {
    if (normalizedInput.includes(keyword) && standardColor) {
      return standardColor;
    }
  }

  // Check for partial matches with higher priority keywords
  const priorityKeywords = ['black', 'white', 'silver', 'gray', 'blue', 'red', 'green'];
  for (const keyword of priorityKeywords) {
    if (normalizedInput.includes(keyword)) {
      const color = COLOR_KEYWORD_MAP[keyword];
      if (color) return color;
    }
  }

  // If no match found, return Unknown
  return 'Unknown';
}

/**
 * Standardizes interior color - always returns 'Black' as per requirements
 * @param rawColor - Original interior color (ignored)
 * @returns Always returns 'Black'
 */
export function standardizeInteriorColor(rawColor?: string): string {
  return 'Black';
}

/**
 * Processes vehicle data to add standardized color fields
 * @param vehicleData - Raw vehicle data
 * @returns Vehicle data with standardized color fields added
 */
export function processVehicleColors<T extends { exterior_color?: string; interior_color?: string }>(
  vehicleData: T
): T & { exterior_color_standardized: string; interior_color_standardized: string } {
  return {
    ...vehicleData,
    exterior_color_standardized: standardizeExteriorColor(vehicleData.exterior_color),
    interior_color_standardized: standardizeInteriorColor(vehicleData.interior_color)
  };
}