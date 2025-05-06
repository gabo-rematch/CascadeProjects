import React, { useState, useEffect, useMemo, useCallback } from 'react';
// No longer need getSupabaseClient here if all logic is in hooks
import CardSection from './CardSection'; // Import the extracted component
import { usePropertyData, useMatchCounts, useMatches } from '../hooks/useMatchingData'; // Import custom hooks

// Descriptions for different matching algorithms
const ALGORITHM_DESCRIPTIONS = {
  'exact': {
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
  },
  'custom': {
    title: 'Custom Match',
    criteria: [
      "Configure matching rules for each field below.",
      "Transaction Type: Always matched.",
    ]
  }
  // Add more algorithms here if needed
};

// --- MatchingPage Component ---
const MatchingPage = () => {
  // State managed directly within MatchingPage
  const [selectedListingId, setSelectedListingId] = useState(''); // Initialize with empty string
  const [selectedRequirementId, setSelectedRequirementId] = useState(''); // Initialize with empty string
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all'); // 'all', 'sale', 'rent'
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('exact'); // State for algorithm

  // State for custom criteria configuration
  const [customCriteria, setCustomCriteria] = useState({
    budget: 'strict', // 'strict' or 'flexible'
    area: 'strict',
    bedrooms: 'strict',
    propertyType: 'strict',
    community: 'strict',
  });

  // Handler to update custom criteria
  const handleCustomCriteriaChange = (field, value) => {
    setCustomCriteria(prev => ({ ...prev, [field]: value }));
    // Note: We might need to trigger a re-fetch of counts/matches here
    // if the custom algorithm is currently selected. Let's address this later.
  };

  // Use the custom hook for listings and requirements
  const {
    listings,
    requirements,
    isLoadingListings,
    isLoadingRequirements,
    errorListings,
    errorRequirements
  } = usePropertyData(transactionTypeFilter);

  // Use the custom hook for match counts
  const {
    listingMatchCounts,
    requirementMatchCounts,
    isLoadingMatchCounts,
    errorMatchCounts
  } = useMatchCounts(selectedAlgorithm, transactionTypeFilter, customCriteria); // Pass customCriteria

  // Use the custom hook for matches
  const {
    matches,
    isLoadingMatches,
    errorMatches,
    fetchMatches, // Function to trigger match fetching
    clearMatches  // Function to clear matches state
  } = useMatches(selectedAlgorithm, transactionTypeFilter, customCriteria); // Pass customCriteria

  // --- Effects --- 

  // Effect for fetching matches when selection changes
  useEffect(() => {
    let sourceId = null;
    let sourceType = null;

    if (selectedListingId) {
      sourceId = selectedListingId;
      sourceType = 'listing';
    } else if (selectedRequirementId) {
      sourceId = selectedRequirementId;
      sourceType = 'requirement';
    }

    if (sourceId && sourceType) {
      fetchMatches(sourceId, sourceType);
    } else {
      clearMatches(); // Clear matches if nothing is selected
    }
    // Depend on the selected IDs and the fetch/clear functions from the hook
  }, [selectedListingId, selectedRequirementId, fetchMatches, clearMatches]);

  // --- Event Handlers --- 

  const handleSelect = (type, id) => {
    const selectValue = id || ''; // Use empty string if id is null/undefined/empty

    if (type === 'listing') {
      setSelectedListingId(selectValue);
      setSelectedRequirementId(''); // Clear the other selection
    } else if (type === 'requirement') {
      setSelectedRequirementId(selectValue);
      setSelectedListingId(''); // Clear the other selection
    }
  };

  // --- Memoized Values --- 

  // Convert IDs to numbers for finding in arrays, handle empty string case
  const numericListingId = selectedListingId ? parseInt(selectedListingId) : null;
  const numericRequirementId = selectedRequirementId ? parseInt(selectedRequirementId) : null;

  const selectedListing = useMemo(() => listings.find(l => l.pk === numericListingId), [listings, numericListingId]);
  const selectedRequirement = useMemo(() => requirements.find(r => r.pk === numericRequirementId), [requirements, numericRequirementId]);

  // Use matches state from the hook directly
  const displayedMatches = matches;

  // Combine loading states
  const isLoading = isLoadingListings || isLoadingRequirements || isLoadingMatchCounts || isLoadingMatches;
  const combinedError = errorListings || errorRequirements || errorMatches || errorMatchCounts; // Combine all potential errors

  // --- Render Logic --- 

  if (combinedError) return <div className="p-4 text-red-600">Error: {combinedError}</div>;

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
            onChange={(e) => setTransactionTypeFilter(e.target.value)}
            className="block w-full p-2 text-sm text-gray-700 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All</option>
            <option value="sale">Sale</option>
            <option value="rent">Rent</option>
          </select>
        </div>

        {/* Algorithm Selector Dropdown */}
        <div className="mb-4 md:mb-0">
          <label htmlFor="algorithmSelector" className="block text-sm font-medium text-gray-700 mb-1">Matching Algorithm:</label>
          <select
            id="algorithmSelector"
            value={selectedAlgorithm}
            onChange={(e) => setSelectedAlgorithm(e.target.value)}
            className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={isLoading} // Disable while initial data or matches are loading
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
          {isLoading && (selectedListingId || selectedRequirementId) && <p className="text-sm text-blue-600">Loading matches...</p>}
          {combinedError && <p className="text-sm text-red-600">Error: {combinedError}</p>}
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

      {/* --- NEW: Custom Criteria Configuration Section --- */}
      {selectedAlgorithm === 'custom' && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg space-y-4 mb-6">
           <h3 className="text-lg font-semibold mb-2">Configure Custom Matching Rules</h3>
           <p className="text-sm mb-4">Define how each field should be matched. "Strict" requires an exact match and non-missing values. "Flexible" allows missing/null values on the requirement side.</p>

           {/* Budget/Price */}
           <div className="flex items-center justify-between">
              <label className="font-medium">Budget / Price:</label>
              <select value={customCriteria.budget} onChange={(e) => handleCustomCriteriaChange('budget', e.target.value)} className="p-1 border rounded">
                 <option value="strict">Strict Range</option>
                 <option value="flexible">Flexible (Allow Missing)</option>
              </select>
           </div>
           {/* Area */}
           <div className="flex items-center justify-between">
              <label className="font-medium">Area (sqft):</label>
              <select value={customCriteria.area} onChange={(e) => handleCustomCriteriaChange('area', e.target.value)} className="p-1 border rounded">
                 <option value="strict">Strict Match</option>
                 <option value="flexible">Flexible (Allow Missing)</option>
              </select>
           </div>
           {/* Bedrooms */}
           <div className="flex items-center justify-between">
              <label className="font-medium">Bedrooms:</label>
              <select value={customCriteria.bedrooms} onChange={(e) => handleCustomCriteriaChange('bedrooms', e.target.value)} className="p-1 border rounded">
                 <option value="strict">Strict Match</option>
                 <option value="flexible">Flexible (Allow Missing)</option>
              </select>
           </div>
           {/* Property Type */}
           <div className="flex items-center justify-between">
              <label className="font-medium">Property Type:</label>
              <select value={customCriteria.propertyType} onChange={(e) => handleCustomCriteriaChange('propertyType', e.target.value)} className="p-1 border rounded">
                 <option value="strict">Strict Match</option>
                 <option value="flexible">Flexible (Allow Missing)</option>
              </select>
           </div>
           {/* Community */}
           <div className="flex items-center justify-between">
              <label className="font-medium">Community:</label>
              <select value={customCriteria.community} onChange={(e) => handleCustomCriteriaChange('community', e.target.value)} className="p-1 border rounded">
                 <option value="strict">Strict Match (In List)</option>
                 <option value="flexible">Flexible (Allow Missing)</option>
              </select>
           </div>
        </div>
      )}

      {/* Main Content Area - Selections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Listing Selector */} 
        <div>
          <label className="font-medium block mb-1">Select Listing:</label>
          <select value={selectedListingId} onChange={(e) => handleSelect('listing', e.target.value)} className="block w-full p-2 text-sm text-gray-700 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500">
            <option value="">-- Select Listing --</option>
            {listings.length === 0 ? (
              <option value="" disabled>No listings match filter</option>
            ) : (
              listings.map(listing => {
                const count = listingMatchCounts[listing.pk];
                const countText = isLoadingMatchCounts ? '(Loading...)' : (count !== undefined ? `(${count})` : '');
                const label = `${listing.listing_title || `Ref: ${listing.property_ref_no || listing.pk}`} ${countText}`;
                return (
                  <option key={listing.pk} value={listing.pk} disabled={isLoading && selectedListingId === listing.pk.toString()}> 
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
          <select value={selectedRequirementId} onChange={(e) => handleSelect('requirement', e.target.value)} className="block w-full p-2 text-sm text-gray-700 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500">
            <option value="">-- Select Requirement --</option>
            {requirements.length === 0 ? (
              <option value="" disabled>No requirements match filter</option>
            ) : (
              requirements.map(req => {
                const count = requirementMatchCounts[req.pk];
                const countText = isLoadingMatchCounts ? '(Loading...)' : (count !== undefined ? `(${count})` : '');
                const label = `${req.client_name || `ID: ${req.pk}`} ${countText}`;
                return (
                  <option key={req.pk} value={req.pk} disabled={isLoading && selectedRequirementId === req.pk.toString()}>
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
                {isLoadingMatches ? (
                  <p>Loading matches...</p>
                ) : errorMatches ? (
                  <p className="text-red-500">Error loading matches: {errorMatches}</p>
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
                {isLoadingMatches ? (
                  <p>Loading matches...</p>
                ) : errorMatches ? (
                  <p className="text-red-500">Error loading matches: {errorMatches}</p>
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