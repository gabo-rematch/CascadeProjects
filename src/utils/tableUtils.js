/**
 * tableUtils.js
 * 
 * Utility functions for table components like ListingsTable.
 */

// Helper to safely get unique values, handling arrays within arrays for multi-selects
export const getUniqueValues = (data, key) => {
  const values = data.flatMap(row => row && row[key]); // Add check for row existence
  // If the values are arrays themselves (like amenities), flatten again
  const flattened = values.flat(); 
  return [...new Set(flattened)].filter(Boolean).sort(); // Filter out falsy values and sort
};

// Helper to parse range strings or numbers
export const parseRangeValue = (val) => {
  if (typeof val === 'number') return [val, val];
  if (typeof val !== 'string' || !val) return [null, null];
  const cleanedVal = val.replace(/,/g, ''); // Remove commas
  // Match numbers possibly separated by hyphen, slash, or just space, allowing decimals
  const match = cleanedVal.match(/^\s*([\d.]+)\s*(?:[-/\s])?\s*([\d.]+)?\s*$/);
  if (match) {
    const min = parseFloat(match[1]);
    // If second number exists, parse it, otherwise use min as max
    const max = match[2] ? parseFloat(match[2]) : min; 
    // Return parsed values or null if NaN
    return [isNaN(min) ? null : min, isNaN(max) ? null : max];
  } 
  // Try parsing as a single number if range regex fails
  const singleNum = parseFloat(cleanedVal);
  return [isNaN(singleNum) ? null : singleNum, isNaN(singleNum) ? null : singleNum];
};

// Mapping function from Supabase row to UI row
export function mapSupabaseRow(row) {
  let amenities = [];
  // Handle cases where facilities might be null or not a string
  if (typeof row.facilities === 'string' && row.facilities.trim() !== '') {
      try {
          // Attempt to parse if it looks like a JSON array string
          if (row.facilities.startsWith('[') && row.facilities.endsWith(']')) {
            amenities = JSON.parse(row.facilities);
            // Ensure it's actually an array
            if (!Array.isArray(amenities)) amenities = []; 
          } else {
             // Otherwise, treat as comma-separated
            amenities = row.facilities.split(',').map(s => s.trim()).filter(Boolean);
          }
      } catch (e) {
          // If JSON parsing fails, fall back to comma separation or empty
          console.warn("Failed to parse facilities, falling back to comma split:", row.facilities, e);
          amenities = row.facilities.split(',').map(s => s.trim()).filter(Boolean);
      }
  }

  // Handle images column (jsonb)
  let pictures = [];
  const rawImages = row.images;

  if (Array.isArray(rawImages)) {
    // If it's already an array, just filter out empty/null values
    pictures = rawImages.filter(p => typeof p === 'string' && p.trim() !== '');
  } else if (typeof rawImages === 'string' && rawImages.trim() !== '') {
    // If it's a non-empty string, try parsing as JSON array
    try {
      const parsed = JSON.parse(rawImages);
      if (Array.isArray(parsed)) {
        pictures = parsed.filter(p => typeof p === 'string' && p.trim() !== '');
      } else {
        // Parsed something, but not an array (unexpected)
        // Fallback: treat as single URL or comma-separated
        pictures = rawImages.split(',').map(s => s.trim()).filter(Boolean);
      }
    } catch (e) {
      // JSON parsing failed, assume comma-separated or single URL
      console.warn(`Failed to parse images JSON string for PK ${row.pk}, falling back to comma split:`, rawImages);
      pictures = rawImages.split(',').map(s => s.trim()).filter(Boolean);
    }
  } // If rawImages is null, undefined, empty string, or not an array/string, pictures remains []


  return {
    pk: row.pk,
    ref: row.property_ref_no || 'N/A',
    type: row.property_type || 'N/A',
    community: row.community || 'N/A',
    price: typeof row.price_aed === 'number' ? row.price_aed : null,
    beds: typeof row.bedr_num === 'number' ? row.bedr_num : null,
    baths: typeof row.bathr_num === 'number' ? row.bathr_num : null, 
    area: typeof row.area_sqft === 'number' ? row.area_sqft : null,
    agent: row.agent_name || 'N/A',
    pictures: pictures, // Use the processed pictures array
    description: row.description || '', 
    amenities: Array.isArray(amenities) ? amenities : [],
    completion_status: row.completion_status || 'N/A', 
    transaction_type: row.transaction_type || 'N/A',
    furnishing: row.furnishing || 'N/A', // Use the furnishing enum column
    vacating_status: row.vacating_status || 'N/A',
    originalPayload: row // Keep the original row for modals/debugging
  };
}
