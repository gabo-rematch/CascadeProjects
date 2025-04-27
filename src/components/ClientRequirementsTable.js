import React, { useState, useEffect } from "react";
import { fetchTableData } from "../supabaseClient";

// Map Supabase row to UI row
function mapRow(row) {
  // Parse the communities string into an array
  let neighborhoods = [];
  if (typeof row.communities === 'string' && row.communities.trim() !== '') {
    neighborhoods = row.communities.split(',') // Split by comma
                                 .map(s => s.trim()) // Remove leading/trailing whitespace
                                 .map(s => s.replace(/[\"\\\[\\\]]/g, '')) // Remove ", [, or ]
                                 .filter(Boolean); // Remove any empty strings resulting from split/trim
  } else if (Array.isArray(row.communities)) {
    // Handle case where it might already be an array (clean elements too)
    neighborhoods = row.communities
                        .map(s => String(s).replace(/[\"\\\[\\\]]/g, '')) // Remove ", [, or ] from existing array elements
                        .filter(Boolean);
  }

  return {
    id: row.id,
    transactionType: row.transaction_type,
    priceRange: {
      min: row.budget_min_aed,
      max: row.budget_max_aed,
    },
    unitSizeRange: {
      min: row.min_area_sqft,
      max: row.unit_size_max || '', // Field to be added later
    },
    neighborhood: neighborhoods, // Assign the processed array
    address: row.location_raw,
    building: row.building || '', // Field to be added later
    bedrooms: row.bedr_num,
    bathrooms: row.bathr_num,
    unitType: row.property_type,
    sourceAgent: row.message_sender,
    sourceAgency: row.source_agency || '', // Field to be added later
    moveInDate: row.move_date,
    furnishing: row.furnishing,
    amenities: row.amenities || [], // Field to be added later
    notes: row.other_details,
    creation_date: row.created_at,
    buyer_type: row.mortgage_or_cash_type,
    pre_approved: row.mortgage_approved,
    off_plan: row.off_plan_bool,
    urgent: row.urgent_bool,
    originalPayload: row.message_original_payload
  };
}

const columns = [
  { key: "transactionType", label: "Type", type: "select" },
  { key: "priceRange", label: "Price Range", type: "range" },
  { key: "unitSizeRange", label: "Unit Size Range", type: "range" },
  { key: "neighborhood", label: "Neighborhood", type: "multi" },
  { key: "building", label: "Building", type: "text" },
  { key: "bedrooms", label: "Beds", type: "multi" },
  { key: "bathrooms", label: "Baths", type: "multi" },
  { key: "unitType", label: "Unit Type", type: "select" },
  { key: "sourceAgent", label: "Agent", type: "text" },
  { key: "sourceAgency", label: "Agency", type: "multi" },
  { key: "moveInDate", label: "Move-in", type: "text" },
  { key: "furnishing", label: "Furnishing", type: "select" },
  { key: "amenities", label: "Amenities", type: "multi" },
  { key: "originalPayload", label: "Original Payload", type: "text" },
];

export default function ClientRequirementsTable() {
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for payload modal
  const [isPayloadModalOpen, setIsPayloadModalOpen] = useState(false);
  const [selectedPayload, setSelectedPayload] = useState(null);

  // Function to open payload modal
  const handleViewPayload = (payload) => {
    setSelectedPayload(payload);
    setIsPayloadModalOpen(true);
  };

  // Function to close payload modal
  const handleClosePayloadModal = () => {
    setIsPayloadModalOpen(false);
    setSelectedPayload(null); // Clear payload when closing
  };

  useEffect(() => {
    async function fetchDataAndMap() {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchTableData("wa_group_client_reqs");
        setData(Array.isArray(rows) ? rows.map(mapRow) : []);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDataAndMap();
  }, []);

  // Helper to get unique values for filter dropdowns
  const getUnique = (key) => {
    const values = data.flatMap(row => {
      const val = row[key];
      // If the key is 'neighborhood' or 'amenities' and it's an array, return its elements
      if ((key === 'neighborhood' || key === 'amenities') && Array.isArray(val)) {
        return val;
      } 
      // Otherwise, return the value itself (even if it's null/undefined for filtering)
      return val;
    });
    // Filter out null/undefined before creating the unique set, then sort
    return [...new Set(values.filter(v => v != null))].sort();
  };

  // Parse min/max from price/unit size range strings (e.g. "$2,000 - $2,500/mo" or "1,000 - 1,200 sq.ft.")
  const parseRange = (val) => {
    if (!val) return [null, null];
    const match = val.match(/([\d,]+)\s*-\s*([\d,]+)/);
    if (match) {
      return [parseInt(match[1].replace(/,/g, "")), parseInt(match[2].replace(/,/g, ""))];
    }
    return [null, null];
  };

  // Filtering logic
  const filtered = data.filter(row => {
    return Object.keys(filters).every(key => {
      const filterVal = filters[key];
      if (filterVal === undefined || filterVal === null || filterVal === "" || (Array.isArray(filterVal) && filterVal.length === 0)) {
        return true; // No filter applied for this key
      }

      const col = columns.find(c => c.key === key);
      if (!col) return true; // Column definition not found?

      const val = row[key];

      if (col.type === "text") {
        return String(val).toLowerCase().includes(String(filterVal).toLowerCase());
      }
      if (col.type === "select") {
        return String(val) === String(filterVal);
      }
      if (col.type === "multi") {
        if (!Array.isArray(filterVal) || filterVal.length === 0) return true;
        // Special handling for array columns like neighborhood/amenities
        if ((key === 'neighborhood' || key === 'amenities') && Array.isArray(val)) {
          // Return true if *any* selected filter value is present in the row's array
          return filterVal.some(f => val.includes(f));
        }
        // Default multi-select logic (e.g., for bedrooms/bathrooms if they are single values)
        return filterVal.includes(val);
      }
      if (col.type === "range") {
        const [min, max] = filterVal;
        const [rowMin, rowMax] = parseRange(val);
        if (min && (rowMax === null || rowMax < Number(min))) return false;
        if (max && (rowMin === null || rowMin > Number(max))) return false;
        return true;
      }
      return true;
    });
  });

  // Track which multi-select dropdown is open
  const [openDropdown, setOpenDropdown] = useState(null);
  // Handle click outside to close dropdowns
  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e) => {
      if (!e.target.closest(`#dropdown-${openDropdown}`)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdown]);

  // Render multi-select dropdown with checkboxes
  const renderMultiSelect = (col) => {
    const options = getUnique(col.key).filter(Boolean);
    const selected = filters[col.key] || [];
    const toggle = (opt) => {
      setFilters(f => {
        const arr = Array.isArray(f[col.key]) ? f[col.key] : [];
        if (arr.includes(opt)) {
          return { ...f, [col.key]: arr.filter(v => v !== opt) };
        } else {
          return { ...f, [col.key]: [...arr, opt] };
        }
      });
    };
    return (
      <div className="relative inline-block text-left" id={`dropdown-${col.key}`}>
        <button
          type="button"
          className="px-2 py-1 border rounded w-24 text-xs bg-background flex items-center justify-between"
          tabIndex={0}
          onClick={() => setOpenDropdown(openDropdown === col.key ? null : col.key)}
        >
          {selected.length > 0 ? `${selected.length} selected` : "All"}
          <span className="ml-1">▼</span>
        </button>
        {openDropdown === col.key && (
          <div className="absolute z-10 mt-1 w-36 bg-white border rounded shadow-lg max-h-40 overflow-auto">
            {options.map(opt => (
              <label key={opt} className="flex items-center px-2 py-1 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="mr-2"
                />
                {opt}
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render filter UI for each column
  const renderFilter = (col) => {
    if (col.type === "text") {
      return (
        <input
          className="px-2 py-1 border rounded w-24 text-xs bg-background"
          placeholder="Filter"
          value={filters[col.key] || ""}
          onChange={e => setFilters(f => ({ ...f, [col.key]: e.target.value }))}
        />
      );
    }
    if (col.type === "select") {
      return (
        <select
          className="px-2 py-1 border rounded w-24 text-xs bg-background"
          value={filters[col.key] || ""}
          onChange={e => setFilters(f => ({ ...f, [col.key]: e.target.value }))}
        >
          <option value="">All</option>
          {getUnique(col.key).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    if (col.type === "multi") {
      return renderMultiSelect(col);
    }
    if (col.type === "range") {
      const [min, max] = filters[col.key] || ["", ""];
      return (
        <div className="flex gap-1">
          <input
            className="px-1 py-1 border rounded w-12 text-xs bg-background"
            placeholder="Min"
            type="number"
            value={min || ""}
            onChange={e => {
              const v = e.target.value;
              setFilters(f => ({ ...f, [col.key]: [v, (f[col.key] || [])[1] || ""] }));
            }}
          />
          <input
            className="px-1 py-1 border rounded w-12 text-xs bg-background"
            placeholder="Max"
            type="number"
            value={max || ""}
            onChange={e => {
              const v = e.target.value;
              setFilters(f => ({ ...f, [col.key]: [(f[col.key] || [])[0] || "", v] }));
            }}
          />
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="p-8 text-center text-lg">Loading client requirements...</div>;
  }
  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Client Requirements</h1>
      <div className="overflow-x-auto rounded-lg shadow border border-accent/30 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-accent/40">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 pt-3 pb-1 font-semibold text-left text-primary">
                  {col.label}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 pb-2 pt-0">
                  {renderFilter(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, rowIndex) => (
              <tr key={row.id ?? `row-${rowIndex}`}> 
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2 whitespace-nowrap text-xs align-top">
                    {/* Specific rendering for neighborhood pills */}
                    {col.key === "neighborhood" && Array.isArray(row[col.key]) ? (
                      (row[col.key] ?? []).map((n, index) => ( 
                        <span key={`${col.key}-item-${index}`} className="bg-accent text-accent-foreground px-2 py-1 rounded text-xs mr-1 inline-block mb-1"> 
                          {n}
                        </span>
                      ))
                    ) 
                    /* Specific rendering for amenities pills */
                    : col.key === "amenities" && Array.isArray(row[col.key]) ? (
                      (row[col.key] ?? []).map((a, index) => ( 
                         <span key={`${col.key}-item-${index}`} className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs mr-1 inline-block mb-1"> 
                          {a}
                        </span>
                      ))
                    ) 
                    /* Specific rendering for range types */
                    : col.type === "range" ? (
                          row[col.key] && typeof row[col.key] === "object"
                            ? `${row[col.key].min ?? ""}${row[col.key].min && row[col.key].max ? " - " : ""}${row[col.key].max ?? ""}`
                            : ""
                        )
                    /* Specific rendering for the originalPayload object */
                    : col.key === "originalPayload" ? (
                      <button 
                        onClick={() => handleViewPayload(row[col.key])} 
                        className="text-blue-600 hover:text-blue-800 text-xs py-1 px-2 rounded bg-blue-100 hover:bg-blue-200 transition-colors"
                        disabled={!row[col.key]} // Disable if no payload
                      >
                        View
                      </button>
                    )
                    /* Specific rendering for boolean types */
                    : col.type === 'boolean' ? (
                        row[col.key] === true ? "Yes" : row[col.key] === false ? "No" : ""
                    )
                    /* Default rendering for text, select, etc. */
                    : (typeof row[col.key] === 'object' && row[col.key] !== null)
                       ? '[Object]' // Avoid rendering raw objects in default case
                       : (row[col.key] ?? "")}
                  </td>
                ))}
               </tr>
             ))}
           </tbody>
        </table>
      </div>

      {/* Payload Modal */}
      {isPayloadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Original Payload</h3>
              <button 
                onClick={handleClosePayloadModal} 
                className="text-gray-500 hover:text-gray-800 text-2xl font-bold"
              >
                &times;
              </button>
            </div>
            <pre className="bg-gray-100 p-4 rounded text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(selectedPayload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
