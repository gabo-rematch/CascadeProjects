import React, { useState, useEffect } from 'react';
import { fetchTableData } from '../supabaseClient';

// Helper to safely get unique values, handling arrays within arrays for multi-selects
const getUniqueValues = (data, key) => {
  const values = data.flatMap(row => row[key]);
  // If the values are arrays themselves (like amenities), flatten again
  const flattened = values.flat(); 
  return [...new Set(flattened)].filter(Boolean).sort(); // Filter out falsy values and sort
};

// Helper to parse range strings or numbers
const parseRangeValue = (val) => {
  if (typeof val === 'number') return [val, val];
  if (typeof val !== 'string' || !val) return [null, null];
  const cleanedVal = val.replace(/,/g, ''); // Remove commas
  const match = cleanedVal.match(/^([\d.]+)\s*[-/]?\s*([\d.]+)?$/);
  if (match) {
    const min = parseFloat(match[1]);
    const max = match[2] ? parseFloat(match[2]) : min; // If no second number, min is max
    return [isNaN(min) ? null : min, isNaN(max) ? null : max];
  } 
  const singleNum = parseFloat(cleanedVal);
  return [isNaN(singleNum) ? null : singleNum, isNaN(singleNum) ? null : singleNum];
};

// Mapping function from Supabase row to UI row
function mapSupabaseRow(row) {
  let amenities = [];
  if (typeof row.facilities === 'string' && row.facilities.trim() !== '') {
    amenities = row.facilities.split(',').map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(row.facilities)) {
    amenities = row.facilities.filter(Boolean);
  }

  let pictures = [];
  const rawImages = row.images;

  if (Array.isArray(rawImages)) {
    // If it's already an array, just filter out empty/null values
    pictures = rawImages.filter(Boolean);
  } else if (typeof rawImages === 'string' && rawImages.trim() !== '') {
    // If it's a non-empty string, try parsing
    try {
      const parsed = JSON.parse(rawImages);
      if (Array.isArray(parsed)) {
        // Successfully parsed a JSON array
        pictures = parsed.filter(Boolean);
      } else {
        // Parsed something, but not an array (unexpected, treat as single URL?)
        // Or fallback to splitting by comma
        console.warn(`Parsed non-array from images string for PK ${row.pk}:`, parsed);
        // Fallback: attempt splitting by comma just in case
        pictures = rawImages.split(',').map(s => s.trim()).filter(Boolean);
      }
    } catch (e) {
      // JSON parsing failed, assume comma-separated or single URL
      pictures = rawImages.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  // If rawImages is null, undefined, empty string, or not an array/string, pictures remains []

  let neighborhood = [];
  if (typeof row.community === 'string' && row.community.trim() !== '') {
    neighborhood = row.community.split(',').map(s => s.trim()).filter(Boolean);
  } else if (Array.isArray(row.community)) {
    neighborhood = row.community.filter(Boolean);
  }

  let daysOnMarket = null;
  if (row.created_date) {
    try {
      const created = new Date(row.created_date);
      const now = new Date();
      daysOnMarket = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    } catch { /* Ignore invalid date */ }
  }

  const listingRef = row.listing_ref_no || row.property_ref_no || '';
  const location = (row.latitude && row.longitude) ? { latitude: row.latitude, longitude: row.longitude } : null;

  return {
    id: row.pk,
    transactionType: row.transaction_type,
    price: row.price_aed,
    unitSize: row.area_sqft,
    neighborhood,
    address: row.location_raw,
    building: row.building_name || '', // Assuming building_name exists
    bedrooms: row.bedr_number,
    bathrooms: row.bathr_number,
    unitType: row.property_type,
    listingTitle: row.listing_title,
    listingRef,
    furnishing: row.furnishing,
    amenities,
    availableFrom: row.available_from,
    pictures, // Keep original images array for carousel
    daysOnMarket,
    location, // Separate location object
    originalPayload: row, // Keep the original row for the modal
  };
}

// Image Carousel Component
function PictureCarousel({ pictures }) {
  const [index, setIndex] = React.useState(0);

  if (!pictures || pictures.length === 0) return null;

  const safePictures = pictures.filter(p => typeof p === 'string'); // Ensure only strings are used
  if (safePictures.length === 0) return null;

  const currentSrc = safePictures[index];

  const prev = (e) => { e.stopPropagation(); setIndex(i => (i === 0 ? safePictures.length - 1 : i - 1)); };
  const next = (e) => { e.stopPropagation(); setIndex(i => (i === safePictures.length - 1 ? 0 : i + 1)); };

  return (
    <div className="flex items-center justify-center gap-1 w-28"> {/* Fixed width container */}
      {safePictures.length > 1 && (
        <button onClick={prev} className="px-1 text-lg text-gray-500 hover:text-gray-800">‹</button>
      )}
      <img
        src={currentSrc} // Use the logged variable
        alt={`Listing ${index + 1}`}
        className="h-12 w-20 object-cover rounded border border-gray-300" // Adjusted size
      />
      {safePictures.length > 1 && (
        <button onClick={next} className="px-1 text-lg text-gray-500 hover:text-gray-800">›</button>
      )}
    </div>
  );
}

// Define this component above ListingsTable
function ExpandableListCell({ items, label, itemClassName, limit = 3, onOpenModal }) {
  // Ensure items is a valid array and filter out non-strings/empty strings
  const validItems = Array.isArray(items)
    ? items.filter(item => typeof item === 'string' && item.trim() !== '')
    : [];

  if (validItems.length === 0) {
    return null; // Return nothing if no valid items
  }

  const displayItems = validItems.slice(0, limit);
  const hasMore = validItems.length > limit;

  const handleViewMoreClick = (e) => {
    e.stopPropagation(); // Prevent triggering row clicks etc.
    onOpenModal(label, validItems); // Pass the label and the full list of valid items
  };

  return (
    <div className='flex flex-wrap items-center gap-1'>
      {displayItems.map((item, index) => (
        // Using index in key as items might not be unique
        <span key={`${label}-item-${index}`} className={itemClassName}>
          {item}
        </span>
      ))}
      {hasMore && (
        <button
          onClick={handleViewMoreClick}
          className="text-blue-600 hover:text-blue-800 text-xs underline pl-1"
          aria-label={`View all ${label}`}
        >
          View More ({validItems.length - limit})
        </button>
      )}
    </div>
  );
}

// Main Table Component
export default function ListingsTable() {
  const [rawData, setRawData] = useState([]);
  const [mappedData, setMappedData] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null); // For multi-select
  const [selectedPayload, setSelectedPayload] = useState(null);
  const [isPayloadModalOpen, setIsPayloadModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [modalListData, setModalListData] = useState({ title: '', items: [] });

  // Define columns here
  const columns = React.useMemo(() => [
    { key: 'listingTitle', label: 'Title', type: 'text' },
    { key: 'transactionType', label: 'Type', type: 'select' },
    { key: 'price', label: 'Price (AED)', type: 'range', format: 'currency' },
    { key: 'unitSize', label: 'Size (sqft)', type: 'range', format: 'number' },
    { key: 'neighborhood', label: 'Neighborhood', type: 'multi' },
    { key: 'address', label: 'Address', type: 'text' },
    { key: 'building', label: 'Building', type: 'text' },
    { key: 'bedrooms', label: 'Beds', type: 'multi', format: 'number' },
    { key: 'bathrooms', label: 'Baths', type: 'multi', format: 'number' },
    { key: 'unitType', label: 'Unit Type', type: 'select' },
    { key: 'furnishing', label: 'Furnishing', type: 'select' },
    { key: 'amenities', label: 'Amenities', type: 'multi' },
    { key: 'availableFrom', label: 'Available', type: 'date' }, // Assuming date filtering might be needed
    { key: 'daysOnMarket', label: 'DoM', type: 'range', format: 'number' },
    { key: 'listingRef', label: 'Ref', type: 'text' },
    { key: 'location', label: 'Map', type: 'location' }, // Special type for map link
    { key: 'originalPayload', label: 'Raw Data', type: 'modal' }, // Special type for modal button
    // Add 'pictures' column separate from the inline display
    { key: 'pictures', label: 'Pics', type: 'none' }, // Not filterable, just for display
  ], []);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    fetchTableData('wa_group_listings')
      .then(fetchedData => {
        // fetchTableData returns only the data array on success, or throws an error
        // The check for fetchError is removed as it will always be undefined here.
        // Errors are handled by the .catch() block.
        setRawData(fetchedData || []);
        setMappedData((fetchedData || []).map(mapSupabaseRow));
        setError(null); // Clear any previous error on successful fetch
      })
      .catch(err => {
        console.error('Error fetching listings:', err);
        setError('Failed to fetch listings. Please check console.');
        setRawData([]);
        setMappedData([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Filter data
  const filteredData = React.useMemo(() => {
    return mappedData.filter(row => {
      return columns.every(col => {
        const filterValue = filters[col.key];
        if (filterValue === undefined || filterValue === '' || (Array.isArray(filterValue) && filterValue.length === 0)) {
          return true; // No filter applied for this column
        }

        const rowValue = row[col.key];

        switch (col.type) {
          case 'text':
            return String(rowValue ?? '').toLowerCase().includes(String(filterValue).toLowerCase());
          case 'select':
            return String(rowValue ?? '') === String(filterValue);
          case 'multi': {            
            const filterArray = Array.isArray(filterValue) ? filterValue : [filterValue];
            const rowArray = Array.isArray(rowValue) ? rowValue.map(String) : [String(rowValue ?? '')];
            // Check if at least one selected filter value is present in the row's values
            return filterArray.some(fv => rowArray.includes(fv));
          }
          case 'range': {
            const [filterMin, filterMax] = filterValue; // Expecting [min, max]
            const [rowMin, rowMax] = parseRangeValue(rowValue);
            
            const passesMin = filterMin === '' || filterMin === null || filterMin === undefined || rowMax === null || rowMax >= parseFloat(filterMin);
            const passesMax = filterMax === '' || filterMax === null || filterMax === undefined || rowMin === null || rowMin <= parseFloat(filterMax);
            return passesMin && passesMax;
          }
          case 'boolean': // Example if needed later
            return !!rowValue === !!filterValue;
          case 'date': // Example if needed later
             if (!filterValue) return true;
             try {
                return new Date(rowValue).toDateString() === new Date(filterValue).toDateString();
             } catch { return false; }
          // Types 'location', 'modal', 'none' are not directly filterable this way
          default:
            return true;
        }
      });
    });
  }, [mappedData, filters, columns]);

  // Handle closing dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      // Only act if a dropdown is currently open
      if (openDropdown === null) return;

      // Check if the click is outside *any* element with the dropdown-id structure
      // This assumes the ID `dropdown-${col.key}` is set on the root element of the dropdown component
      if (!e.target.closest(`[id^="dropdown-"]`)) {
          setOpenDropdown(null); // Close the currently open dropdown
      }
    };

    // Add the listener unconditionally
    document.addEventListener('mousedown', handler);
    // Cleanup function to remove the listener unconditionally
    return () => document.removeEventListener('mousedown', handler);
  }, [openDropdown]); // Re-run this effect only when openDropdown changes


  // --- Filter Rendering --- 

  const renderMultiSelect = (col) => {
    const options = getUniqueValues(mappedData, col.key);
    const selected = filters[col.key] || [];
    
    const toggleOption = (opt) => {
        setFilters(prevFilters => {
            const currentSelection = prevFilters[col.key] || [];
            const newSelection = currentSelection.includes(opt)
                ? currentSelection.filter(v => v !== opt)
                : [...currentSelection, opt];
            return { ...prevFilters, [col.key]: newSelection };
        });
    };

    return (
      <div className="relative inline-block text-left" id={`dropdown-${col.key}`}>
        <button
          type="button"
          className="px-2 py-1 border border-gray-300 rounded w-full text-xs bg-white flex items-center justify-between min-w-[80px]" // Ensure minimum width
          onClick={() => setOpenDropdown(openDropdown === col.key ? null : col.key)}
        >
          <span className='truncate pr-1'>{selected.length > 0 ? `${selected.length} selected` : 'All'}</span>
          <span>▼</span>
        </button>
        {openDropdown === col.key && (
          <div className="absolute z-10 mt-1 w-48 max-h-60 overflow-y-auto bg-white border border-gray-300 rounded shadow-lg">
            {options.map(opt => (
              <label key={opt} className="flex items-center px-3 py-1 text-xs hover:bg-gray-100 cursor-pointer">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={selected.includes(opt)}
                  onChange={() => toggleOption(opt)}
                />
                {opt}
              </label>
            ))}
            {options.length === 0 && <span className='text-xs text-gray-500 px-3 py-1'>No options</span>}
          </div>
        )}
      </div>
    );
  };

  const renderFilter = (col) => {
    if (col.type === 'none' || col.type === 'location' || col.type === 'modal') return null; // No filter UI for these

    if (col.type === 'text') {
      return (
        <input
          type="text"
          placeholder="Filter..."
          className="px-2 py-1 border border-gray-300 rounded w-full text-xs bg-white min-w-[80px]"
          value={filters[col.key] || ''}
          onChange={e => setFilters(f => ({ ...f, [col.key]: e.target.value }))}
        />
      );
    }
    if (col.type === 'select' || (col.type === 'multi' && col.format === 'number')) { // Use select for numeric multi like beds/baths
      const options = getUniqueValues(mappedData, col.key);
      return (
        <select
          className="px-2 py-1 border border-gray-300 rounded w-full text-xs bg-white min-w-[60px]"
          value={filters[col.key] || ''}
          onChange={e => setFilters(f => ({ ...f, [col.key]: e.target.value }))}
        >
          <option value="">All</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    if (col.type === 'multi') {
      return renderMultiSelect(col);
    }
    if (col.type === 'range') {
      const [min, max] = filters[col.key] || ['', ''];
      return (
        <div className="flex gap-1 justify-center">
          <input
            type="number"
            placeholder="Min"
            className="px-1 py-1 border border-gray-300 rounded w-14 text-xs bg-white"
            value={min}
            onChange={e => {
              const v = e.target.value;
              setFilters(f => ({ ...f, [col.key]: [v, (f[col.key] || [])[1] || ''] }));
            }}
          />
          <input
            type="number"
            placeholder="Max"
            className="px-1 py-1 border border-gray-300 rounded w-14 text-xs bg-white"
            value={max}
            onChange={e => {
              const v = e.target.value;
              setFilters(f => ({ ...f, [col.key]: [(f[col.key] || [])[0] || '', v] }));
            }}
          />
        </div>
      );
    }
    return null;
  };

  // --- Modal Handling --- 
  const handleViewPayload = (payload) => {
    setSelectedPayload(payload);
    setIsPayloadModalOpen(true);
  };

  const handleClosePayloadModal = () => {
    setIsPayloadModalOpen(false);
    setSelectedPayload(null); // Clear payload when closing
  };

  const handleOpenListModal = (title, items) => {
    setModalListData({ title, items });
    setIsListModalOpen(true);
  };

  const handleCloseListModal = () => {
    setIsListModalOpen(false);
    // Optional: Clear data if you prefer
    // setModalListData({ title: '', items: [] });
  };

  // --- Formatting --- 
  const formatValue = (value, format) => {
    if (value === null || value === undefined) return '';
    if (format === 'currency') {
      return parseFloat(value).toLocaleString('en-US', { style: 'currency', currency: 'AED', minimumFractionDigits: 0 });
    }
    if (format === 'number') {
      return parseFloat(value).toLocaleString('en-US');
    }
    if (value instanceof Date) {
        return value.toLocaleDateString(); // Basic date formatting
    }
    return String(value);
  };

  // --- Render --- 
  if (loading) return <div className="p-8 text-center">Loading listings...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Error: {error}</div>;

  return (
    <div className="p-4 sm:p-8"> {/* Responsive padding */} 
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Property Listings</h1>
      <div className="overflow-x-auto rounded-lg shadow border border-gray-200 bg-white">
        <table className="min-w-full text-sm align-top">
          <thead className="bg-gray-100 sticky top-0 z-20">
            {/* Column Labels */}
            <tr>
              {/* Add Picture column header first */}
              <th className="px-3 py-2 font-semibold text-left text-gray-700 whitespace-nowrap">Picture</th> 
              {columns.filter(c => c.key !== 'pictures').map((col) => (
                <th key={col.key} className="px-3 py-2 font-semibold text-left text-gray-700 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
            {/* Filter Row */}
            <tr>
              <th className="px-3 pb-2 pt-0"></th>{/* Empty cell for picture filter */}
              {columns.filter(c => c.key !== 'pictures').map((col) => (
                <th key={`${col.key}-filter`} className="px-3 pb-2 pt-0 align-top">
                  {renderFilter(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="text-center py-8 text-gray-500">
                  No listings found matching your filters.
                </td>
              </tr>
            )}
            {filteredData.map((row) => (
              <tr key={row.id} className="even:bg-gray-50 hover:bg-gray-100 transition-colors border-t border-gray-200">
                {/* Picture Cell First */}
                <td className="px-3 py-2 whitespace-nowrap align-middle">
                  <PictureCarousel pictures={row.pictures} />
                </td>
                {/* Data Cells */}
                {columns.filter(c => c.key !== 'pictures').map((col) => {
                  const cellValue = row[col.key];
                  let cellContent = null; // Variable to hold the content for the cell

                  // Define base style classes for list items based on column
                  let itemStyleClass = "bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs"; // Default
                  if (col.key === 'amenities') {
                      itemStyleClass = "bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs";
                  } else if (col.key === 'neighborhood') {
                      itemStyleClass = "bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs";
                  }
                  // Add more `else if` for other array columns if needed

                  // Determine cell content based on column type and value
                  if (col.type === 'multi' && Array.isArray(cellValue)) {
                    // Use ExpandableListCell for array types identified as 'multi'
                    cellContent = (
                      <ExpandableListCell
                        items={cellValue}
                        label={col.label} // Pass the column label as title for the modal
                        itemClassName={itemStyleClass} // Pass the specific style
                        limit={3} // Show 3 items initially
                        onOpenModal={handleOpenListModal} // Pass the handler function
                      />
                    );
                  } else if (col.type === 'location' && row.location) {
                    // Keep existing location logic
                    cellContent = (
                      <a
                        href={`https://www.google.com/maps?q=${row.location.latitude},${row.location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        View Map
                      </a>
                    );
                  } else if (col.type === 'modal') {
                    // Keep existing modal logic
                    cellContent = (
                      <button 
                        onClick={() => handleViewPayload(row.originalPayload)} 
                        className="text-blue-600 hover:text-blue-800 text-xs py-1 px-2 rounded bg-blue-100 hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!row.originalPayload}
                      >
                        View Raw
                      </button>
                    );
                  } else if (col.type === 'boolean') {
                    // Keep existing boolean logic
                    cellContent = cellValue === true ? 'Yes' : cellValue === false ? 'No' : '';
                  } else {
                    // Default formatting for all other types
                    cellContent = formatValue(cellValue, col.format);
                  }

                  // Render the table cell with the determined content
                  return (
                    <td key={col.key} className="px-3 py-2 whitespace-nowrap text-xs align-top">
                      {cellContent}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payload Modal Implementation (Basic Example) */}
      {isPayloadModalOpen && selectedPayload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh]">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">Raw Listing Data</h2>
              <button onClick={handleClosePayloadModal} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-100px)]"> {/* Adjust max-h based on header/footer */}
              <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                {JSON.stringify(selectedPayload, null, 2)}
              </pre>
            </div>
             <div className="flex justify-end p-3 border-t">
                 <button 
                    onClick={handleClosePayloadModal} 
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
                 >
                     Close
                 </button>
            </div>
          </div>
        </div>
      )}

      {/* List Modal Implementation */}
      {isListModalOpen && modalListData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh]">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-lg font-semibold">{modalListData.title}</h2>
              <button onClick={handleCloseListModal} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-100px)]"> {/* Adjust max-h based on header/footer */}
              <ul className="list-disc pl-4">
                {modalListData.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
             <div className="flex justify-end p-3 border-t">
                 <button 
                    onClick={handleCloseListModal} 
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
                 >
                     Close
                 </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
