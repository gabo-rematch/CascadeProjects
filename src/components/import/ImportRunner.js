import React, { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { XMLParser } from 'fast-xml-parser';
import { getSupabaseClient } from '../../supabaseClient'; // <-- Import getSupabaseClient function

const supabase = getSupabaseClient(); // <-- Get the client instance

export default function ImportRunner({ file, url, content, mappingConfig, targetTable, onImportComplete, onImportError }) {
  const [status, setStatus] = useState('idle'); // idle, processing, complete, error
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null); // { added: N, updated: M, failed: P, errors: [...] }
  const [error, setError] = useState(null);
  const hasRunImportRef = useRef(false);

  // Define runImport outside useEffect, wrapped in useCallback
  const runImport = useCallback(async () => {
    // Double check needed props based on source type
    if ((!file && !url) || !mappingConfig || !targetTable) {
      setError('Missing required data (file/url, mapping, or target table).');
      setStatus('error');
      return;
    }

    try {
      let fileText;
      let parsedData;
      let sourceFields = []; // Keep track of original fields for potential error reporting
      let isCsv = false;
      let isXml = false;

      setStatus('processing');
      setProgress(10); // Initial progress
      setError('');
      setResults(null);

      // Determine source and get content
      if (file) {
        console.log('Processing uploaded file:', file.name);
        fileText = await file.text();
        isCsv = file.type === 'text/csv' || file.name.endsWith('.csv');
        isXml = file.type === 'text/xml' || file.name.endsWith('.xml');
      } else if (url && content) {
        console.log('Processing content from URL:', url);
        fileText = content; // Use pre-fetched content
        // Assume XML for URL sources based on current setup
        // Might need enhancement if URL could point to CSV
        isXml = true;
      } else {
        throw new Error('Invalid data source provided.');
      }

      setProgress(25); // Progress after getting content

      // Parse based on type
      if (isCsv) {
        const parseResult = Papa.parse(fileText, { header: true, skipEmptyLines: true });
        if (parseResult.errors.length > 0) {
          // Log errors but try to continue if data exists
          console.warn('CSV Parsing errors:', parseResult.errors);
          if (!parseResult.data || parseResult.data.length === 0) {
            throw new Error(`CSV parsing failed: ${parseResult.errors[0].message}`);
          }
        }
        parsedData = parseResult.data;
        sourceFields = parseResult.meta.fields || [];
      } else if (isXml) {
        const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
        if (file) {
          const jsonObj = parser.parse(fileText);
          parsedData = findRecordArray(jsonObj); // Use existing helper
          if (!parsedData) {
            throw new Error('Could not find an array of records in the XML structure.');
          }
          if (parsedData.length > 0) {
            sourceFields = Object.keys(parsedData[0]);
          }
        } else if (url && content) {
          console.log('[ImportRunner] Parsing XML content from URL...');
          const parser = new XMLParser({ 
            ignoreAttributes: false, 
            attributeNamePrefix: "@_",
            ignoreDeclaration: true 
          }); 
          const parsedResult = parser.parse(content);
          console.log('[ImportRunner] Raw XML Parsed Result Structure:', parsedResult);
          parsedData = parsedResult.Listings && parsedResult.Listings.Listing ?
                       (Array.isArray(parsedResult.Listings.Listing) ? parsedResult.Listings.Listing : [parsedResult.Listings.Listing])
                       : null;
          if (!parsedData) {
            throw new Error('Could not find an array of records in the XML structure.');
          }
          if (parsedData.length > 0) {
            sourceFields = Object.keys(parsedData[0]);
          }
        }
      } else {
        throw new Error('Unsupported file type or source.');
      }

      // Log the parsed data structure
      console.log('[ImportRunner] Parsed data (first 5 records):', parsedData.slice(0, 5)); // Log first few records
      if (parsedData.length === 0) {
        console.warn('[ImportRunner] Parsed data is empty!');
      }

      setProgress(50);
      console.log('[ImportRunner] Data parsed successfully, starting transformation.');

      // Apply mapping configuration
      setStatus('Applying mapping configuration...');
      let currentProcessed = 0; // Track progress within mapping
      const transformedData = parsedData.map((rawRecord, index) => { // Add index argument
        const transformedRecord = {};
        // Log details for the first record only
        if (index === 0) {
          console.log('[ImportRunner] Processing first rawRecord:', rawRecord);
        }
        for (const sourceField in mappingConfig) {
          const targetField = mappingConfig[sourceField];
          // Check if the raw record has the field AND a target is selected
          if (rawRecord.hasOwnProperty(sourceField) && targetField && targetField !== '--ignore--') {
            let valueToAssign = rawRecord[sourceField];

            // --- General NULL value handling ---
            if (typeof valueToAssign === 'string') {
              const lowerTrimmedValue = valueToAssign.trim().toLowerCase();
              if (['na', 'n/a', 'null', 'none', ''].includes(lowerTrimmedValue)) {
                valueToAssign = null;
                if (index === 0) { // Log only for the first record for brevity
                  console.log(`[ImportRunner] Mapped '${rawRecord[sourceField]}' to null for ${targetField}`);
                }
              }
            }
            // --- End General NULL value handling ---

            // --- Specific handling for JSON/array columns ---
            if (targetField === 'facilities') {
              // Check for nested 'facility' array
              if (valueToAssign && typeof valueToAssign === 'object' && Array.isArray(valueToAssign.facility)) {
                valueToAssign = valueToAssign.facility;
                if (index === 0) console.log(`[ImportRunner] Extracted facilities array:`, valueToAssign);
              } else {
                // Handle cases where it's not the expected object or is something else (e.g., simple string?)
                if (index === 0) console.warn(`[ImportRunner] Unexpected structure for ${sourceField}. Assigning empty array. Value was:`, valueToAssign);
                valueToAssign = []; // Default to empty array if structure is wrong
              }
            } else if (targetField === 'images') {
              // Assume nested 'image' or 'url' array (adjust key if different)
              const imageKey = 'image'; // Or 'url', 'Image', etc. - CHECK YOUR XML
              if (valueToAssign && typeof valueToAssign === 'object' && Array.isArray(valueToAssign[imageKey])) {
                valueToAssign = valueToAssign[imageKey];
                 if (index === 0) console.log(`[ImportRunner] Extracted images array:`, valueToAssign);
              } else {
                if (index === 0) console.warn(`[ImportRunner] Unexpected structure for ${sourceField}. Assigning empty array. Value was:`, valueToAssign);
                valueToAssign = []; // Default to empty array
              }
            }
            // --- Specific handling for ENUM columns ---
            else if ((targetField === 'property_type' || targetField === 'transaction_type') && typeof valueToAssign === 'string') {
              const originalValue = valueToAssign; // Keep original for logging if needed
              valueToAssign = valueToAssign.toLowerCase();

              // Specific value mapping for property_type
              if (targetField === 'property_type' && valueToAssign === 'land residential') {
                valueToAssign = 'land';
                if (index === 0) {
                  console.log(`[ImportRunner] Mapped '${originalValue}' to 'land' for ${targetField}`);
                }
              } 
              // Specific value mapping for transaction_type
              else if (targetField === 'transaction_type' && valueToAssign === 'rental') {
                valueToAssign = 'rent';
                if (index === 0) {
                  console.log(`[ImportRunner] Mapped '${originalValue}' to 'rent' for ${targetField}`);
                }
              } 
              // Log generic lowercase conversion if no specific mapping applied
              else if (index === 0) {
                console.log(`[ImportRunner] Converted ${targetField} to lowercase:`, valueToAssign);
              }
            }
            // --- Specific handling for BigInt columns (rounding) ---
            else if (targetField === 'area_sqft' && valueToAssign !== null && valueToAssign !== undefined) {
               const numValue = parseFloat(valueToAssign);
               if (!isNaN(numValue)) {
                 valueToAssign = Math.round(numValue);
                 if (index === 0) {
                   console.log(`[ImportRunner] Rounded ${targetField} to integer:`, valueToAssign);
                 }
               } else {
                 // Handle cases where parsing failed (e.g., non-numeric string)
                 valueToAssign = null; // Or 0, depending on requirements
                 if (index === 0) {
                    console.warn(`[ImportRunner] Could not parse ${targetField} to number. Assigning null. Value was:`, rawRecord[sourceField]);
                 }
               }
            }
            // --- Specific handling for bedr_num (Studio -> 0, Int parsing, 7+ -> 11) ---
            else if (targetField === 'bedr_num' && valueToAssign !== null && valueToAssign !== undefined) {
               let parsedIntValue = null;
               if (typeof valueToAssign === 'string' && valueToAssign.toLowerCase() === 'studio') {
                 parsedIntValue = 0;
                 if (index === 0) console.log(`[ImportRunner] Mapped 'Studio' to 0 for ${targetField}`);
               } else {
                 const intValue = parseInt(valueToAssign, 10);
                 if (!isNaN(intValue)) {
                   parsedIntValue = intValue;
                   if (index === 0) console.log(`[ImportRunner] Parsed ${targetField} to integer:`, parsedIntValue);
                 } else {
                   // Handle non-numeric, non-Studio values
                   if (index === 0) console.warn(`[ImportRunner] Could not parse ${targetField} to integer. Assigning null. Value was:`, rawRecord[sourceField]);
                 }
               }
               // Apply 7+ rule if we have a valid number
               if (parsedIntValue !== null) {
                 if (parsedIntValue >= 7) {
                   valueToAssign = 11;
                   if (index === 0) console.log(`[ImportRunner] Mapped ${targetField} value >= 7 to 11`);
                 } else {
                   valueToAssign = parsedIntValue; // Use the parsed value if < 7
                 }
               } else {
                  valueToAssign = null; // Ensure it's null if parsing failed
               }
            }
            // --- Specific handling for bathr_num (Int parsing, 7+ -> 11) ---
            else if (targetField === 'bathr_num' && valueToAssign !== null && valueToAssign !== undefined) {
               const intValue = parseInt(valueToAssign, 10);
               if (!isNaN(intValue)) {
                 if (intValue >= 7) {
                   valueToAssign = 11;
                   if (index === 0) console.log(`[ImportRunner] Mapped ${targetField} value >= 7 to 11`);
                 } else {
                   valueToAssign = intValue; // Use the parsed value if < 7
                   if (index === 0) console.log(`[ImportRunner] Parsed ${targetField} to integer:`, valueToAssign);
                 }
               } else {
                  // Handle non-numeric values
                  valueToAssign = null;
                  if (index === 0) console.warn(`[ImportRunner] Could not parse ${targetField} to integer. Assigning null. Value was:`, rawRecord[sourceField]);
               }
            }
            // --- End specific handling ---

            // Log when a field is successfully mapped for the first record
            if (index === 0 && !['facilities', 'images', 'property_type', 'transaction_type', 'area_sqft', 'bedr_num', 'bathr_num'].includes(targetField)) { // Avoid double logging
              console.log(`[ImportRunner] Mapping: ${sourceField} -> ${targetField}, Value: ${valueToAssign}`);
            }
            // Assign the potentially transformed value
            transformedRecord[targetField] = valueToAssign;
          } else if (index === 0 && rawRecord.hasOwnProperty(sourceField)) {
            // Log why a field wasn't mapped for the first record (if it existed)
            console.log(`[ImportRunner] Not mapping ${sourceField}: Target field is '${targetField}'`);
          } else if (index === 0 && !rawRecord.hasOwnProperty(sourceField)) {
            // Log if source field wasn't even found in rawRecord
            console.log(`[ImportRunner] Raw record does not have property: ${sourceField}`);
          }
        } // End for...in mappingConfig loop

        // --- Post-transformation checks/fallbacks ---
        if (transformedRecord.location_raw == null && transformedRecord.community != null) {
          transformedRecord.location_raw = transformedRecord.community;
          if (index === 0) { // Log only for first record
            console.log(`[ImportRunner] Fallback: Set location_raw to community value:`, transformedRecord.location_raw);
          }
        }
        // --- End post-transformation checks ---

        // Log the resulting transformed record for the first raw record
        if (index === 0) {
          console.log('[ImportRunner] First transformedRecord:', transformedRecord);
        }
        currentProcessed++;
        setProgress(50 + (currentProcessed / parsedData.length) * 30); // Progress within mapping
        return transformedRecord;
      }).filter(record => Object.keys(record).length > 0);

      console.log(`[ImportRunner] Transformation complete. ${transformedData.length} records prepared.`);

      // 3. Call Supabase Edge Function
      setStatus('Calling Supabase Edge Function...');
      const functionPayload = { targetTable, dataChunk: transformedData };
      console.log('[ImportRunner] Invoking Supabase function:', 'import-processor', 'with payload:', functionPayload);

      const { data: functionResult, error: functionError } = await supabase.functions.invoke('import-processor', {
        body: functionPayload,
      });

      if (functionError) {
        console.error('Supabase function invocation error:', functionError);
        throw new Error(`Failed to run import function: ${functionError.message}`);
      }

      if (functionResult.error) {
        console.error('Error reported by import function:', functionResult.error);
        throw new Error(`Import processing failed: ${functionResult.error}`);
      }

      console.log('Import function success response:', functionResult);

      // Simulate completion
      await new Promise(resolve => setTimeout(resolve, 500)); // Short delay
      setStatus('Import simulation complete. Check console for details.');

      // Notify parent component
      onImportComplete();

    } catch (err) {
      console.error('Import process failed:', err);
      setError(err.message);
      setStatus('error');
      onImportError(err);
    }
  }, [file, url, content, mappingConfig, targetTable, onImportComplete, onImportError]); // Dependencies for useCallback

  useEffect(() => {
    // Reset state and hasRun flag when source data changes
    hasRunImportRef.current = false;
    setStatus('idle');
    setProgress(0);
    setError(null);
    setResults(null);
    console.log('[ImportRunner] props changed or component mounted. Resetting state.');

    // Log condition values before checking
    console.log('[ImportRunner] Checking auto-trigger condition:', {
      hasMapping: !!mappingConfig && Object.keys(mappingConfig).length > 0,
      hasFile: !!file,
      hasUrl: !!url,
      hasContent: !!content,
      hasSource: !!(file || (url && content)),
      hasTargetTable: !!targetTable,
      hasRun: hasRunImportRef.current,
      mappingConfig: mappingConfig // Log the actual config too
    });

    // Auto-trigger import if mapping is confirmed and valid
    if (mappingConfig && Object.keys(mappingConfig).length > 0 && (file || (url && content)) && targetTable && !hasRunImportRef.current) {
        console.log('[ImportRunner] Mapping confirmed, auto-triggering import.');
        runImport();
    }

  }, [file, url, content, mappingConfig, targetTable, runImport]); // Include runImport in dependencies

  return (
    <div className="mt-4 p-4 border rounded bg-gray-50">
      <h3 className="text-lg font-semibold mb-2">Import Status</h3>
      {status === 'idle' && <p>Ready to start import.</p>}
      {status === 'processing' && (
        <div>
          <p>Processing {file ? `file ${file.name}` : `URL ${url}`}...</p> {/* Indicate source */}
          <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-200 rounded">
          <p className="font-semibold">Error during import:</p>
          <p className="text-sm">{error}</p>
        </div>
      )}
      {/* Button removed - import runs automatically */}
    </div>
  );
}

// Helper function to find the array of records in the XML structure
function findRecordArray(jsonObj) {
  let recordsArray = null;
  const rootKey = Object.keys(jsonObj)[0]; // Get the root element name
  if (jsonObj[rootKey]) {
    // Check if root element itself is an array (unlikely but possible)
    if (Array.isArray(jsonObj[rootKey])) {
      recordsArray = jsonObj[rootKey];
    }
    // Look for a common pattern like <Root><Item>...</Item></Root>
    else if (typeof jsonObj[rootKey] === 'object') {
      const potentialArrayKey = Object.keys(jsonObj[rootKey])[0];
      if (potentialArrayKey && Array.isArray(jsonObj[rootKey][potentialArrayKey])) {
        recordsArray = jsonObj[rootKey][potentialArrayKey];
      }
      // Handle case where root contains the single record object directly
      else if (potentialArrayKey && typeof jsonObj[rootKey][potentialArrayKey] === 'object' && !Array.isArray(jsonObj[rootKey][potentialArrayKey])) {
        recordsArray = [jsonObj[rootKey][potentialArrayKey]]; // Wrap single object in array
      } else if (typeof jsonObj[rootKey] === 'object' && Object.keys(jsonObj[rootKey]).length > 0) {
        // Fallback: If root contains a single object that IS the record
        recordsArray = [jsonObj[rootKey]];
      }
    }
  }
  return recordsArray;
}
