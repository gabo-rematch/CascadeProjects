import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getSupabaseClient, fetchTableData } from '../supabaseClient'; // Ensure this path is correct
import CardSection from './CardSection'; // Import the extracted component

// Descriptions for different matching algorithms
const ALGORITHM_DESCRIPTIONS = {
  'v1': {
    title: 'Exact Match (v1)',
    criteria: [
      "Transaction Type: Listing and Requirement must have the same type (Sale/Rent).",
      "Bedrooms: Listing bedrooms must exactly match Requirement bedrooms.",
      "Budget/Price: Listing price (AED) must fall within the Requirement's budget range (min/max AED).",
      "Community: Listing community must be one of the communities specified in the Requirement.",
      "Property Type: Listing unit type (e.g., apartment, townhouse) must match Requirement's unit type."
    ]
  },
  'priority_v1': {
    title: 'Priority Match (priority_v1)',
    criteria: [
      "Transaction Type: Must match.",
      "Bedrooms: Exact match preferred, +/- 1 allowed.",
      "Budget/Price: Listing price within budget range preferred, small variances allowed.",
      "Community: Exact match preferred, nearby communities considered.",
      "Property Type: Exact match preferred, similar types considered.",
      "(Note: This is a sample description - actual logic may vary)"
    ]
  }
  // Add more algorithms here if needed
};

// --- Main MatchingPage Component ---
const MatchingPage = () => {
  // --- State --- 
  const [listingsData, setListingsData] = useState([]);
  const [requirementsData, setRequirementsData] = useState([]);
  const [selectedListingId, setSelectedListingId] = useState('');
  const [selectedRequirementId, setSelectedRequirementId] = useState('');
  const [displayedMatches, setDisplayedMatches] = useState([]); // State for matches of the selected item
  const [loading, setLoading] = useState(false); // Combined loading state for initial fetch and match fetch
  const [error, setError] = useState(null);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('v1'); // State for algorithm
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('All'); // 'All', 'Sale', 'Rent'
  const [listingMatchCounts, setListingMatchCounts] = useState({}); // New state for listing counts { pk: count }
  const [requirementMatchCounts, setRequirementMatchCounts] = useState({}); // New state for requirement counts { pk: count }
  const [countsLoading, setCountsLoading] = useState(false); // New state for counts loading

  // --- Constants --- 
  const LISTINGS_TABLE = 'wa_group_listings'; 
  const REQUIREMENTS_TABLE = 'wa_group_client_reqs'; // Define constant

  // --- Effects --- 

  // Fetch initial data
  useEffect(() => {
    setLoading(true);
    let isMounted = true; 
    const fetchData = async () => {
      try {
        const [listingsResponse, requirementsResponse] = await Promise.all([
          fetchTableData(LISTINGS_TABLE),
          fetchTableData(REQUIREMENTS_TABLE)
        ]);
        if (isMounted) {
            setListingsData(listingsResponse || []);
            setRequirementsData(requirementsResponse || []);
            setError(null);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        if (isMounted) {
            setError(error.message);
            setListingsData([]);
            setRequirementsData([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => { isMounted = false; }; // Cleanup on unmount
  }, []); // Run only once on mount

  // Fetch match counts
  useEffect(() => {
    const fetchCounts = async () => {
      if (!getSupabaseClient()) return;
      setCountsLoading(true);
      try {
        const [listingCountsRes, requirementCountsRes] = await Promise.all([
          getSupabaseClient().rpc('get_match_counts', {
            p_source_type: 'listing',
            p_match_algorithm: selectedAlgorithm,
            p_transaction_filter: transactionTypeFilter
          }),
          getSupabaseClient().rpc('get_match_counts', {
            p_source_type: 'requirement',
            p_match_algorithm: selectedAlgorithm,
            p_transaction_filter: transactionTypeFilter
          })
        ]);

        if (listingCountsRes.error) throw listingCountsRes.error;
        if (requirementCountsRes.error) throw requirementCountsRes.error;

        // Convert arrays to maps for easy lookup
        const listingCountsMap = (listingCountsRes.data || []).reduce((acc, item) => {
          acc[item.source_pk] = item.match_count;
          return acc;
        }, {});
        const requirementCountsMap = (requirementCountsRes.data || []).reduce((acc, item) => {
          acc[item.source_pk] = item.match_count;
          return acc;
        }, {});

        setListingMatchCounts(listingCountsMap);
        setRequirementMatchCounts(requirementCountsMap);

      } catch (err) {
        console.error("Error fetching match counts:", err);
        // Optionally set an error state for counts
      } finally {
        setCountsLoading(false);
      }
    };

    fetchCounts();
  }, [selectedAlgorithm, transactionTypeFilter]); // Re-fetch when algorithm or filter changes

  // Filter dropdown options based on transaction type
  const filteredListings = useMemo(() => {
    if (transactionTypeFilter === 'All') return listingsData; // Use original data
    return listingsData.filter(listing => 
        listing.transaction_type?.toLowerCase() === transactionTypeFilter.toLowerCase()
    );
  }, [listingsData, transactionTypeFilter]);

  const filteredRequirements = useMemo(() => {
    if (transactionTypeFilter === 'All') return requirementsData; // Use original data
    return requirementsData.filter(req => 
        req.transaction_type?.toLowerCase() === transactionTypeFilter.toLowerCase()
    );
  }, [requirementsData, transactionTypeFilter]);

  // Find the currently selected full listing/requirement object from the initially fetched data
  const selectedListing = useMemo(() => {
    if (!selectedListingId) return null;
    // Find from original listingsData, not calculatedListings
    return listingsData.find(l => l.pk === parseInt(selectedListingId));
  }, [selectedListingId, listingsData]);

  const selectedRequirement = useMemo(() => {
    if (!selectedRequirementId) return null;
    // Find from original requirementsData, not calculatedRequirements
    return requirementsData.find(req => req.pk === parseInt(selectedRequirementId));
  }, [selectedRequirementId, requirementsData]);


  // --- Handlers --- 
  const handleListingSelect = async (event) => {
    const pk = event.target.value;
    setSelectedListingId(pk);
    setSelectedRequirementId(''); // Clear requirement selection
    setDisplayedMatches([]); // Clear previous matches
    setError(null); // Clear previous errors

    if (pk) {
      setLoading(true); // Start loading matches
      try {
        console.log(`Fetching matches for listing PK: ${pk}, Algorithm: ${selectedAlgorithm}, Filter: ${transactionTypeFilter}`);
        const supabase = getSupabaseClient(); // Get client instance
        const { data: matchesData, error: rpcError } = await supabase.rpc('get_matches', {
          p_source_pk: parseInt(pk),
          p_source_type: 'listing',
          p_match_algorithm: selectedAlgorithm,
          p_transaction_filter: transactionTypeFilter
        });

        if (rpcError) {
          throw rpcError;
        }

        console.log("Found Matching Requirements:", matchesData); // Debugging
        setDisplayedMatches(matchesData || []); // Update state with matches
      } catch (err) {
        console.error("Error fetching matching requirements:", err);
        setError(err.message || 'Failed to fetch matching requirements');
        setDisplayedMatches([]); // Clear matches on error
      } finally {
        setLoading(false); // Stop loading matches
      }
    } else {
      // No PK selected, clear everything
      setDisplayedMatches([]); 
      setError(null);
    }
  };

  const handleRequirementSelect = async (event) => {
    const pk = event.target.value;
    setSelectedRequirementId(pk);
    setSelectedListingId(''); // Clear listing selection
    setDisplayedMatches([]); // Clear previous matches
    setError(null); // Clear previous errors

    if (pk) {
      setLoading(true); // Start loading matches
       try {
        console.log(`Fetching matches for requirement PK: ${pk}, Algorithm: ${selectedAlgorithm}, Filter: ${transactionTypeFilter}`);
        const supabase = getSupabaseClient(); // Get client instance
        const { data: matchesData, error: rpcError } = await supabase.rpc('get_matches', {
          p_source_pk: parseInt(pk),
          p_source_type: 'requirement',
          p_match_algorithm: selectedAlgorithm,
          p_transaction_filter: transactionTypeFilter
        });

        if (rpcError) {
          throw rpcError;
        }
        console.log("Found Matching Listings:", matchesData); // Debugging
        setDisplayedMatches(matchesData || []); // Update state with matches
      } catch (err) {
        console.error("Error fetching matching listings:", err);
        setError(err.message || 'Failed to fetch matching listings');
        setDisplayedMatches([]); // Clear matches on error
      } finally {
        setLoading(false); // Stop loading matches
      }
    } else {
        // No PK selected, clear everything
        setDisplayedMatches([]); 
        setError(null);
    }
  };

  // Restore handler for Transaction Type Filter
  const handleTransactionTypeFilterChange = (e) => {
    setTransactionTypeFilter(e.target.value);
    // Clear selections when filter changes
    setSelectedListingId(''); 
    setSelectedRequirementId('');
    setDisplayedMatches([]);
  };

  const handleAlgorithmChange = (event) => {
    setSelectedAlgorithm(event.target.value);
    // Clear selections and displayed matches when algorithm changes
    setSelectedListingId(''); 
    setSelectedRequirementId('');
    setDisplayedMatches([]);
  };

  // --- UI Rendering --- 
  if (loading) return <div className="p-4">Loading data...</div>; // Combined loading state
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold mb-4">Property Matcher</h1>

      {/* Filters Row */}
      <div className="flex gap-4 mb-6 items-end">
        {/* Transaction Type Filter Dropdown */}
        <div className="mb-4 md:mb-0">
          <label htmlFor="transactionTypeFilter" className="block text-sm font-medium text-gray-700 mb-1">Transaction Type:</label>
          <select
            id="transactionTypeFilter"
            name="transactionTypeFilter"
            value={transactionTypeFilter}
            onChange={handleTransactionTypeFilterChange}
            className="block w-full p-2 text-sm text-gray-700 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="All">All</option>
            <option value="Sale">Sale</option>
            <option value="Rent">Rent</option>
          </select>
        </div>

        {/* Algorithm Selector Dropdown */}
        <div className="mb-4 md:mb-0">
          <label htmlFor="algorithmSelector" className="block text-sm font-medium text-gray-700 mb-1">Matching Algorithm:</label>
          <select
            id="algorithmSelector"
            name="algorithmSelector"
            value={selectedAlgorithm}
            onChange={handleAlgorithmChange}
            className="block w-full p-2 text-sm text-gray-700 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
          >
            {Object.keys(ALGORITHM_DESCRIPTIONS).map(algoKey => (
              <option key={algoKey} value={algoKey}>
                {ALGORITHM_DESCRIPTIONS[algoKey].title}
              </option>
            ))}
          </select>
        </div>

        {/* Loading/Error Indicator for Match Fetching */} 
        <div className="flex items-end justify-end">
          {loading && (selectedListingId || selectedRequirementId) && <p className="text-sm text-blue-600">Loading matches...</p>}
          {error && <p className="text-sm text-red-600">Error: {error}</p>}
        </div>
      </div>

      {/* --- Matching Criteria Help Section (Dynamic) --- */}
      {ALGORITHM_DESCRIPTIONS[selectedAlgorithm] && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg text-sm mb-6">
          <h3 className="font-semibold mb-2">{ALGORITHM_DESCRIPTIONS[selectedAlgorithm].title}</h3>
          <ul className="list-disc pl-5 space-y-1">
            {ALGORITHM_DESCRIPTIONS[selectedAlgorithm].criteria.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Content Area - Selections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Listing Selector */} 
        <div>
          <label className="font-medium block mb-1">Select Listing:</label>
          <select value={selectedListingId} onChange={handleListingSelect} className="block w-full p-2 text-sm text-gray-700 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500">
            <option value="">-- Select Listing --</option>
            {filteredListings.length === 0 ? (
              <option value="" disabled>No listings match filter</option>
            ) : (
              filteredListings.map(listing => {
                const count = listingMatchCounts[listing.pk];
                const countText = countsLoading ? '(Loading...)' : (count !== undefined ? `(${count})` : '');
                const label = `${listing.listing_title || `Ref: ${listing.property_ref_no || listing.pk}`} ${countText}`;
                return (
                  <option key={listing.pk} value={listing.pk} disabled={loading && selectedListingId === listing.pk.toString()}> 
                    {label}
                  </option>
                );
              })
            )}
          </select>
        </div>

        {/* Requirement Selector */} 
        <div>
          <label className="font-medium block mb-1">Select Requirement:</label>
          <select value={selectedRequirementId} onChange={handleRequirementSelect} className="block w-full p-2 text-sm text-gray-700 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500">
            <option value="">-- Select Requirement --</option>
            {filteredRequirements.length === 0 ? (
              <option value="" disabled>No requirements match filter</option>
            ) : (
              filteredRequirements.map(req => {
                const count = requirementMatchCounts[req.pk];
                const countText = countsLoading ? '(Loading...)' : (count !== undefined ? `(${count})` : '');
                const label = `${req.client_name || `ID: ${req.pk}`} ${countText}`;
                return (
                  <option key={req.pk} value={req.pk} disabled={loading && selectedRequirementId === req.pk.toString()}>
                    {label}
                  </option>
                );
              })
            )}
          </select>
        </div>
      </div>

      {/* Selected Item and Matches */}
      {(selectedListing || selectedRequirement) && (
        <div className="mt-6">
          {selectedListingId && (
            <div className="flex flex-col lg:flex-row gap-4"> 
              {/* Selected Listing Card */} 
              {selectedListing && (
                <div className="border p-4 rounded-lg bg-gray-50 h-fit lg:w-1/2"> 
                  <h3 className="font-semibold text-lg mb-2">
                    Selected Listing {listingMatchCounts[selectedListing.pk] !== undefined ? `(${listingMatchCounts[selectedListing.pk]})` : ''}
                  </h3>
                  <CardSection data={selectedListing} type="listing" />
                </div>
              )}

              {/* Matches for Listing */} 
              <div className="border p-4 rounded-lg bg-white lg:w-1/2 flex-grow"> 
                <h3 className="font-semibold text-lg mb-2">
                  Matches for Listing
                </h3>
                {loading ? (
                  <p>Loading matches...</p>
                ) : error ? (
                  <p className="text-red-500">Error: {error}</p>
                ) : displayedMatches.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2"> 
                    {displayedMatches.map((match, index) => (
                      <CardSection key={index} data={match} type="requirement" />
                    ))}
                  </div>
                ) : (
                  <p>No matches found.</p>
                )}
              </div>
            </div>
          )}
          {selectedRequirementId && (
            <div className="flex flex-col lg:flex-row gap-4"> 
              {/* Selected Requirement Card */} 
              {selectedRequirement && (
                <div className="border p-4 rounded-lg bg-gray-50 h-fit lg:w-1/2"> 
                  <h3 className="font-semibold text-lg mb-2">
                    Selected Requirement {requirementMatchCounts[selectedRequirement.pk] !== undefined ? `(${requirementMatchCounts[selectedRequirement.pk]})` : ''}
                  </h3>
                  <CardSection data={selectedRequirement} type="requirement" />
                </div>
              )}

              {/* Matches for Requirement */} 
              <div className="border p-4 rounded-lg bg-white lg:w-1/2 flex-grow"> 
                <h3 className="font-semibold text-lg mb-2">
                  Matches for Requirement
                </h3>
                {loading ? (
                  <p>Loading matches...</p>
                ) : error ? (
                  <p className="text-red-500">Error: {error}</p>
                ) : displayedMatches.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2"> 
                    {displayedMatches.map((match, index) => (
                      <CardSection key={index} data={match} type="listing" />
                    ))}
                  </div>
                ) : (
                  <p>No matches found.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchingPage;