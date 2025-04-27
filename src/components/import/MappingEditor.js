import React, { useState, useEffect } from 'react';
import { fetchTableColumnsFromRows } from '../../supabaseClient'; // Adjust path as needed

export default function MappingEditor({ sourceFields, targetTable, onMappingComplete }) {
  const [fieldMappings, setFieldMappings] = useState({});
  const [targetColumns, setTargetColumns] = useState([]);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [schemaError, setSchemaError] = useState(null);

  // Log received source fields
  console.log('[MappingEditor] Received sourceFields prop:', sourceFields);

  // Fetch target columns when the targetTable changes
  useEffect(() => {
    if (!targetTable) return;

    const loadSchema = async () => {
      setIsLoadingSchema(true);
      setSchemaError(null);
      setTargetColumns([]); // Clear previous columns
      setFieldMappings({}); // Reset mappings when table changes
      try {
        // Note: This fetches column names based on the first row.
        // For full type info, a different approach (e.g., RPC) might be needed later.
        const columns = await fetchTableColumnsFromRows(targetTable);
        setTargetColumns(columns);
        console.log('[MappingEditor] Target columns loaded:', columns); // Log loaded columns

        // Optional: Auto-map based on name matching (case-insensitive)
        const initialMappings = {};
        sourceFields.forEach(source => {
          const matchedTarget = columns.find(target => target.toLowerCase() === source.toLowerCase());
          if (matchedTarget) {
            initialMappings[source] = matchedTarget;
          } else {
            initialMappings[source] = ''; // Default to 'Do not import'
          }
        });
        setFieldMappings(initialMappings);

      } catch (error) {
        console.error(`Error fetching schema for table ${targetTable}:`, error);
        setSchemaError(`Failed to load columns for table '${targetTable}'. Please check console.`);
      } finally {
        setIsLoadingSchema(false);
      }
    };

    loadSchema();
  }, [targetTable, sourceFields]); // Rerun if targetTable or sourceFields change

  const handleMappingChange = (sourceField, event) => {
    const targetField = event.target.value;
    setFieldMappings(prev => ({
      ...prev,
      [sourceField]: targetField === '--ignore--' ? '' : targetField,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    // Filter out any fields mapped to '' (Do not import)
    const finalMappings = Object.entries(fieldMappings)
      .filter(([_, target]) => target)
      .reduce((acc, [source, target]) => {
        acc[source] = target;
        return acc;
      }, {});
    console.log('[MappingEditor] handleSubmit triggered.'); // Log trigger
    console.log('[MappingEditor] Final mapping config:', finalMappings); // Log the mapping
    onMappingComplete(finalMappings);
  };

  if (isLoadingSchema) {
    return <div className="text-center p-4">Loading target table schema...</div>;
  }

  if (schemaError) {
    return <div className="text-center p-4 text-red-600">Error: {schemaError}</div>;
  }

  // Sort source fields alphabetically for the dropdown
  const sortedSourceFields = [...sourceFields].sort((a, b) => a.localeCompare(b));
  // Derive sorted target columns directly from state before render
  const sortedTargetColumns = [...targetColumns].sort((a, b) => a.localeCompare(b));

  // Log just before rendering
  console.log('[MappingEditor] Rendering with sortedTargetColumns:', sortedTargetColumns);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-xl font-semibold">Map Fields to '{targetTable}'</h2>
      <p className="text-sm text-gray-600">Match the columns from your file (Source) to the columns in the database (Target). Select 'Do not import' to skip a column.</p>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source Field (from file)</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Field (in {targetTable})</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedSourceFields.map((sourceField) => {
              // Log the options being generated for the source dropdown
              console.log(`[MappingEditor] Generating dropdown for source field: ${sourceField}`);
              return (
                <tr key={sourceField}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{sourceField}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <select
                      value={fieldMappings[sourceField] || '--ignore--'}
                      onChange={(e) => handleMappingChange(sourceField, e)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                      aria-label={`Map ${sourceField} to target field`}
                    >
                      <option value="--ignore--">Do not import</option>
                      {/* Ensure this map uses the derived sortedTargetColumns */}
                      {sortedTargetColumns.map((targetCol) => (
                        <option key={targetCol} value={targetCol}>
                          {targetCol}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          disabled={isLoadingSchema || Object.keys(fieldMappings).length === 0} // Basic disable condition
        >
          Confirm & Import
        </button>
      </div>
    </form>
  );
}
