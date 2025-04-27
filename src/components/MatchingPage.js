import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchTableData } from '../supabaseClient';

// Helper to safely convert to lowercase string or null
const safeLowerCase = (str) => (str ? String(str).trim().toLowerCase() : null);

// Helper to safely parse float or return null
const safeParseFloat = (val) => {
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

// Helper to safely parse integer or return null
const safeParseInt = (val) => {
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
};

// Helper to normalize community list
const normalizeCommunityList = (communities) => {
  if (!communities) return [];
  if (Array.isArray(communities)) return communities.map(safeLowerCase).filter(Boolean);
  if (typeof communities === 'string') return communities.split(',').map(safeLowerCase).filter(Boolean);
  return [];
}

// --- Main Matching Logic (defined outside component) ---
const findMatches = (sourceItem, sourceItemType, targetList, algorithmType = 'priority') => { // Added algorithmType param
  console.log(`[findMatches] Start: source=${sourceItem?.pk}, type=${sourceItemType}, targetCount=${targetList?.length}, algo=${algorithmType}`);
  if (!sourceItem || !targetList || !Array.isArray(targetList) || targetList.length === 0) {
    console.warn('[findMatches] Invalid input: sourceItem or targetList missing/invalid.');
    return [];
  }

  // --- Field Value Extraction --- 
  const getReqValues = (req) => ({
    id: req.pk,
    priceMin: safeParseFloat(req.budget_min_aed),
    priceMax: safeParseFloat(req.budget_max_aed),
    size: safeParseFloat(req.area_sqft), 
    communities: normalizeCommunityList(req.communities),
    unitType: safeLowerCase(req.property_type),
    transactionType: safeLowerCase(req.transaction_type),
    bedrooms: safeParseInt(req.bedrooms),
    rawCommunity: req.communities, // Keep raw value for NA checks
    rawPrice: req.budget_min_aed || req.budget_max_aed // Check if any price is set
  });

  const getListValues = (listing) => ({
    id: listing.pk,
    price: safeParseFloat(listing.price_aed),
    size: safeParseFloat(listing.area_sqft),
    community: safeLowerCase(listing.community),
    unitType: safeLowerCase(listing.property_type),
    transactionType: safeLowerCase(listing.transaction_type),
    bedrooms: safeParseInt(listing.bedrooms),
    rawCommunity: listing.community // Keep raw value for NA checks
  });
  
  // --- Filtering Logic based on Algorithm ---
  try { // Add try...catch for safety during filtering
    return targetList.filter(targetItem => {
      let req, listing; // Declare vars for requirement and listing values
      console.log(`[findMatches] Filtering target: ${targetItem?.pk}`);

      if (sourceItemType === 'client') {
        req = getReqValues(sourceItem);
        listing = getListValues(targetItem);
      } else { // sourceItemType === 'listing'
        listing = getListValues(sourceItem); // Corrected: Was getReqValues
        req = getReqValues(targetItem);     // Corrected: Was getListValues
      }

      console.log(`[findMatches] Comparing Req:`, req, `Listing:`, listing);

      // --- Common Checks --- 
      // 1. Transaction Type (Must always match)
      if (!req.transactionType || !listing.transactionType || listing.transactionType !== req.transactionType) {
        return false;
      }

      // --- Algorithm-Specific Checks --- 
      if (algorithmType === 'exact') {
        // 2. Unit Type (Must match if req specifies)
        if (req.unitType && (!listing.unitType || listing.unitType !== req.unitType)) return false;
        // 3. Community (Must match if req specifies non-NA)
        if (req.rawCommunity && req.rawCommunity !== 'NA') { // Check if req specifies a real community
          if (!listing.community || !req.communities.includes(listing.community)) return false;
        } else { // If req community is NA, null, or empty, it's an incomplete requirement
          return false; 
        }
        // 4. Price (Strict range + 5% max allowance, reject if req price is NA)
        if (!req.rawPrice || req.rawPrice === 'NA') return false; // Reject if req price missing
        if (listing.price === null) return false; // Reject if listing price missing
        const maxAllowed = req.priceMax ? req.priceMax * 1.05 : null;
        if (req.priceMin !== null && listing.price < req.priceMin) return false;
        if (maxAllowed !== null && listing.price > maxAllowed) return false;
        // 5. Unit Size (±30% allowed if req specifies)
        if (req.size !== null) {
          if (listing.size === null) return false;
          const sizeLowerBound = req.size * 0.7;
          const sizeUpperBound = req.size * 1.3;
          if (listing.size < sizeLowerBound || listing.size > sizeUpperBound) return false;
        }
        // 6. Bedrooms (Must match exactly if req specifies)
        if (req.bedrooms == null) {
          // null/undefined means 'any', skip check
        } else {
          if (listing.bedrooms == null || listing.bedrooms !== req.bedrooms) return false;
        }

      } else if (algorithmType === 'priority') {
        // 2. Unit Type (Must match if req specifies)
        if (req.unitType && (!listing.unitType || listing.unitType !== req.unitType)) return false;
        // 3. Community (Must match if req specifies non-NA; allow any if NA)
        if (req.rawCommunity && req.rawCommunity !== 'NA') { 
           if (!listing.community || !req.communities.includes(listing.community)) return false;
        } // If NA or null, allow any community - no 'else return false'
        // 4. Price (Range + 20% max allowance; allow any if req price is NA)
        if (req.rawPrice && req.rawPrice !== 'NA') { // Only filter if req price is set
           if (listing.price === null) return false;
           const maxAllowed = req.priceMax ? req.priceMax * 1.20 : null;
           if (req.priceMin !== null && listing.price < req.priceMin) return false;
           if (maxAllowed !== null && listing.price > maxAllowed) return false;
        } // Allow any listing price if req price is NA
        // 5. Unit Size (±30% allowed if req specifies)
        if (req.size !== null) {
          if (listing.size === null) return false; 
          const sizeLowerBound = req.size * 0.7;
          const sizeUpperBound = req.size * 1.3;
          if (listing.size < sizeLowerBound || listing.size > sizeUpperBound) return false;
        }
        // 6. Bedrooms (±1 allowed if req specifies)
        if (req.bedrooms == null) {
          // null/undefined means 'any', skip check
        } else {
          if (listing.bedrooms == null || Math.abs(listing.bedrooms - req.bedrooms) > 1) return false;
        }

      } else if (algorithmType === 'exploratory') {
        // 2. Unit Type (Ignore)
        // 3. Community (Ignore)
        // 4. Price (Max +20%, Min -20%; allow any if req price is NA)
         if (req.rawPrice && req.rawPrice !== 'NA') { // Only filter if req price is set
           if (listing.price === null) return false;
           const maxAllowed = req.priceMax ? req.priceMax * 1.20 : null;
           const minAllowed = req.priceMin ? req.priceMin * 0.80 : null;
           if (minAllowed !== null && listing.price < minAllowed) return false;
           if (maxAllowed !== null && listing.price > maxAllowed) return false;
         } // Allow any listing price if req price is NA
        // 5. Unit Size (±30% allowed if req specifies)
         if (req.size !== null) {
           if (listing.size === null) return false; 
           const sizeLowerBound = req.size * 0.7;
           const sizeUpperBound = req.size * 1.3;
           if (listing.size < sizeLowerBound || listing.size > sizeUpperBound) return false;
         }
        // 6. Bedrooms (Ignore)

      } else if (algorithmType === 'custom') {
        // Custom logic based on customRules state
        const { matchUnitType, matchCommunity, priceTolerancePercent, sizeTolerancePercent, matchBedrooms } = customRules;

        // 2. Unit Type (Match if specified)
        if (matchUnitType && req.unitType && (!listing.unitType || listing.unitType !== req.unitType)) return false;

        // 3. Community (Match based on custom rule)
        if (matchCommunity === 'strict') {
          if (req.rawCommunity && req.rawCommunity !== 'NA') { 
            if (!listing.community || !req.communities.includes(listing.community)) return false;
          } else { // If req community is NA, null, or empty, it's an incomplete requirement
            return false; 
          }
        } else if (matchCommunity === 'flexible') {
          if (req.rawCommunity && req.rawCommunity !== 'NA') { 
            if (!listing.community || !req.communities.includes(listing.community)) return false;
          }
        }

        // 4. Price (Custom tolerance)
        if (req.rawPrice && req.rawPrice !== 'NA') { // Only filter if req price is set
          if (listing.price === null) return false;
          const maxAllowed = req.priceMax ? req.priceMax * (1 + priceTolerancePercent / 100) : null;
          if (req.priceMin !== null && listing.price < req.priceMin) return false;
          if (maxAllowed !== null && listing.price > maxAllowed) return false;
        }

        // 5. Unit Size (Custom tolerance)
        if (req.size !== null) {
          if (listing.size === null) return false; 
          const sizeLowerBound = req.size * (1 - sizeTolerancePercent / 100);
          const sizeUpperBound = req.size * (1 + sizeTolerancePercent / 100);
          if (listing.size < sizeLowerBound || listing.size > sizeUpperBound) return false;
        }

        // 6. Bedrooms (Custom match)
        if (matchBedrooms === 'strict') {
          if (req.bedrooms == null) {
            // null/undefined means 'any', skip check
          } else {
            if (listing.bedrooms == null || listing.bedrooms !== req.bedrooms) return false;
          }
        } else if (matchBedrooms === 'flexible') {
          if (req.bedrooms == null) {
            // null/undefined means 'any', skip check
          } else {
            if (listing.bedrooms == null || Math.abs(listing.bedrooms - req.bedrooms) > 1) return false;
          }
        }

      }

      // If all checks pass for the selected algorithm
      return true; 
    });
  } catch (error) {
    console.error("[findMatches] Error during filtering:", error, "Source:", sourceItem, "Target List:", targetList);
    return []; // Return empty array on error
  }
};

// --- React Component --- 
function CardSection({ title, children }) {
  return (
    <section className="mb-4">
      <h2 className="text-lg font-semibold mb-2 text-primary-foreground/80">{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function PropertyCard({ data, type }) {
  // Helper to format currency (can be extracted later)
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return parseFloat(value).toLocaleString('en-US', { style: 'currency', currency: 'AED', minimumFractionDigits: 0 });
  };

  // Helper to format range
  const formatRange = (min, max, unit = '') => {
    if (min === null && max === null) return 'N/A';
    const minVal = min !== null ? parseFloat(min).toLocaleString('en-US') : 'Any';
    const maxVal = max !== null ? parseFloat(max).toLocaleString('en-US') : 'Any';
    if (minVal === maxVal) return `${minVal}${unit}`;
    return `${minVal} - ${maxVal}${unit}`;
  };

  // Helper to display array items
  const renderListItems = (items) => {
    const validItems = Array.isArray(items) ? items.filter(Boolean) : typeof items === 'string' ? items.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (validItems.length === 0) return <span className="text-xs text-gray-500">None specified</span>;
    return validItems.map((item, index) => (
      <span key={index} className="bg-accent text-accent-foreground px-2 py-1 rounded text-xs">
        {item}
      </span>
    ));
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 w-full border border-accent/30">
      <h1 className="text-xl font-bold mb-4 text-primary">
        {type === 'client' ? 'Client Requirement' : 'Listing'}
      </h1>
      {type === 'client' && (
        <div className="mb-2 text-xs text-gray-500 font-mono">
          Requirement ID: <span className="font-semibold text-primary">{data?.pk}</span>
        </div>
      )}
      {type !== 'client' && data?.property_ref_no && (
        <div className="mb-2 text-xs text-gray-500 font-mono">
          Listing Ref: <span className="font-semibold text-primary">{data.property_ref_no}</span>
        </div>
      )}


      <CardSection title="Basic Info">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {type === 'client' ? (
            <>
              <span className="font-medium">Transaction:</span>
              <span>{data?.transaction_type || 'N/A'}</span>
              <span className="font-medium">Budget:</span>
              <span>{
                (data?.budget_min_aed && data?.budget_max_aed)
                  ? `${parseInt(data.budget_min_aed).toLocaleString()} - ${parseInt(data.budget_max_aed).toLocaleString()} AED`
                  : data?.budget_min_aed
                    ? `${parseInt(data.budget_min_aed).toLocaleString()} AED`
                    : data?.budget_max_aed
                      ? `${parseInt(data.budget_max_aed).toLocaleString()} AED`
                      : 'N/A'
              }</span>
              <span className="font-medium">Unit Size:</span>
              <span>{data?.area_sqft ? `${parseInt(data.area_sqft).toLocaleString()} sqft` : 'N/A'}</span>
              <span className="font-medium">Communities:</span>
              <span className="col-span-1">
                {Array.isArray(data?.communities) && data.communities.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {data.communities.map((c, i) => (
                      <span key={i} className="bg-accent text-accent-foreground px-2 py-1 rounded text-xs">{c}</span>
                    ))}
                  </span>
                ) : (
                  data?.communities || 'N/A'
                )}
              </span>
              <span className="font-medium">Bedrooms:</span>
              <span>{data?.bedr_num !== undefined && data?.bedr_num !== null ? data.bedr_num : 'N/A'}</span>
              <span className="font-medium">Bathrooms:</span>
              <span>{data?.bathr_num !== undefined && data?.bathr_num !== null ? data.bathr_num : 'N/A'}</span>
              <span className="font-medium">Unit Type:</span>
              <span>{data?.property_type || 'N/A'}</span>
            </>
          ) : (
            <>
              <span className="font-medium">Transaction:</span>
              <span>{data?.transaction_type || 'N/A'}</span>
              <span className="font-medium">Price:</span>
              <span>{data?.price_aed ? `${parseInt(data.price_aed).toLocaleString()} AED` : 'N/A'}</span>
              <span className="font-medium">Unit Size:</span>
              <span>{data?.area_sqft ? `${parseInt(data.area_sqft).toLocaleString()} sqft` : 'N/A'}</span>
              <span className="font-medium">Community:</span>
              <span>{data?.community || 'N/A'}</span>
              <span className="font-medium">Bedrooms:</span>
              <span>{data?.bedr_num !== undefined && data?.bedr_num !== null ? data.bedr_num : 'N/A'}</span>
              <span className="font-medium">Bathrooms:</span>
              <span>{data?.bathr_num !== undefined && data?.bathr_num !== null ? data.bathr_num : 'N/A'}</span>
              <span className="font-medium">Unit Type:</span>
              <span>{data?.property_type || 'N/A'}</span>
              <span className="font-medium">Listing Ref:</span>
              <span>{data?.property_ref_no || 'N/A'}</span>
              <span className="font-medium">Listing Title:</span>
              <span>{data?.listing_title || 'N/A'}</span>
            </>
          )}
        </div>
      </CardSection>
      <CardSection title={type === 'client' ? 'Source' : 'Listing Info'}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {type === 'client' ? (
            <>
              {/* Assuming fields like client_name, client_phone */} 
              <span className="font-medium">Client Name:</span>
              <span>{data?.client_name || 'N/A'}</span>
              <span className="font-medium">Client Phone:</span>
              <span>{data?.client_phone || 'N/A'}</span>
              <span className="font-medium">Source Agent:</span>
              <span>{data?.agent_name || 'N/A'}</span>
            </>
          ) : (
            <>
              <span className="font-medium">Listing Agent:</span>
              <span>{data?.agent_name || 'N/A'}</span>
              <span className="font-medium">Days on Market:</span>
              <span>{(() => {
                if (!data?.created_at) return 'N/A';
                // Ensure standard ISO format (replace space with T)
                const dateString = data.created_at.replace(' ', 'T');
                const created = new Date(dateString);
                if (isNaN(created.getTime())) { // Check if date parsing failed
                  console.error("Failed to parse date:", data.created_at);
                  return 'N/A'; 
                }
                const today = new Date();
                // Compare timestamps directly to avoid timezone issues
                const diff = Math.floor((today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
                return diff >= 0 ? diff : '0'; // Show 0 if created today, handle potential microsecond differences
              })()}</span>
              <span className="font-medium">Listing Ref:</span>
              <span>{data?.listing_ref_no || data?.property_ref_no || 'N/A'}</span>
            </>
          )}
        </div>
      </CardSection>
      <CardSection title="Amenities / Facilities">
        <div className="flex flex-wrap gap-2">
          {Array.isArray(data?.facilities) && data.facilities.length > 0
            ? data.facilities.map((a, i) => (
                <span key={i} className="bg-accent text-accent-foreground px-2 py-1 rounded text-xs">
                  {a}
                </span>
              ))
            : <span className="text-xs text-gray-500">None specified</span>
          }
        </div>
      </CardSection>

      {type !== 'client' && data?.other_details && (
        <CardSection title="Description">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{data.other_details}</p>
        </CardSection>
      )}

      {type === 'client' ? (
        <CardSection title="Other Details">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="font-medium">Move-in Date:</span>
            <span>{data?.move_date || 'N/A'}</span>
            <span className="font-medium">Furnishing:</span>
            <span>{data?.furnishing || 'Any'}</span>
            <span className="font-medium">Other Details:</span>
            <span className="col-span-1">{data?.other_details || 'None'}</span>
          </div>
        </CardSection>
      ) : (
        <CardSection title="Images & Details">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-sm">Furnishing: {data?.furnishing || 'N/A'}</span>
            {/* Render all images as thumbnails */}
            {Array.isArray(data?.images) && data.images.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2"> 
                {data.images.map((img, i) => (
                  <img key={i} src={img} alt={`Listing Image ${i+1}`} className="rounded-lg border w-24 h-24 object-cover" />
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-500">No images</span>
            )}
          </div>
        </CardSection>
      )}
    </div>
  );
}

function MatchingPage() {
  // --- LOG MOVED --- 

  const [listingsData, setListingsData] = useState([]);
  const [requirementsData, setRequirementsData] = useState([]);
  const [selectedListingId, setSelectedListingId] = useState('');
  console.log('[MatchingPage Render] selectedListingId:', selectedListingId);
  const [selectedRequirementId, setSelectedRequirementId] = useState('');
  const [suggestedMatches, setSuggestedMatches] = useState([]);
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('All'); // Rent, Sale, All
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('priority'); // Algorithm state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // --- State for Custom Match Rules --- 
  const [customRules, setCustomRules] = useState({
    matchUnitType: true,      // Checkbox: Must unit types match?
    matchCommunity: 'strict', // Select: 'strict' (must match), 'flexible' (allow NA), 'ignore'
    priceTolerancePercent: 20, // Number input/slider: % allowance above max price
    sizeTolerancePercent: 30,  // Number input/slider: +/- % allowance for size
    matchBedrooms: 'flexible' // Select: 'strict' (exact), 'flexible' (+/- 1), 'ignore'
  });

  // Handler for updating custom rules
  const handleCustomRuleChange = (ruleName, value) => {
    setCustomRules(prevRules => ({
      ...prevRules,
      [ruleName]: value
    }));
  };

  // Constants for table names
  const LISTINGS_TABLE = 'wa_group_listings';
  const REQUIREMENTS_TABLE = 'wa_group_client_reqs';

  // --- MOVED useMemo hooks for selected items RIGHT AFTER useState --- 
  const selectedListing = useMemo(() => {
    if (!selectedListingId) return null;
    console.log('[useMemo SelectedListing] Finding listing ID:', selectedListingId);
    // console.log('[useMemo SelectedListing] Searching in listingsData:', listingsData);
    const found = listingsData.find(l => String(l.pk) === selectedListingId);
    console.log('[useMemo SelectedListing] Found:', found);
    return found;
  }, [selectedListingId, listingsData]);
  
  const selectedRequirement = useMemo(() => {
    if (!selectedRequirementId) return null;
    console.log('[useMemo SelectedRequirement] Finding requirement ID:', selectedRequirementId);
    // console.log('[useMemo SelectedRequirement] Searching in requirementsData:', requirementsData);
    const found = requirementsData.find(r => String(r.pk) === selectedRequirementId);
    console.log('[useMemo SelectedRequirement] Found:', found);
    return found;
  }, [selectedRequirementId, requirementsData]);

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true); // Set loading true at the start
      setError(null); // Clear previous errors
      try {
        const [fetchedListings, fetchedRequirements] = await Promise.all([
          fetchTableData(LISTINGS_TABLE),
          fetchTableData(REQUIREMENTS_TABLE)
        ]);
        setListingsData(fetchedListings || []);
        setRequirementsData(fetchedRequirements || []);

      } catch (err) {
        console.error("Error fetching matching data:", err);
        setError("Failed to load listings and requirements.");
        setListingsData([]);
        setRequirementsData([]);
      } finally {
        setLoading(false); // Set loading false on success or error
      }
    };
    fetchData();
  }, []);

  // Calculate potential match counts for each listing
  const listingsWithMatchCounts = useMemo(() => {
    console.log('[useMemo] Calculating listing match counts. Algo:', selectedAlgorithm);
    if (!Array.isArray(listingsData) || !Array.isArray(requirementsData)) {
        console.warn('[useMemo] listingsData or requirementsData not ready for listing counts.');
        return [];
    }
    return listingsData.map(listing => ({
      ...listing,
      _matchCount: findMatches(listing, 'listing', requirementsData, selectedAlgorithm).length // Pass algorithm
    }));
  }, [listingsData, requirementsData, selectedAlgorithm]); // Add selectedAlgorithm dependency

  // Calculate potential match counts for each requirement
  const requirementsWithMatchCounts = useMemo(() => {
    console.log('[useMemo] Calculating requirement match counts. Algo:', selectedAlgorithm);
     if (!Array.isArray(listingsData) || !Array.isArray(requirementsData)) {
        console.warn('[useMemo] listingsData or requirementsData not ready for requirement counts.');
        return [];
    }
    return requirementsData.map(req => ({
      ...req,
      _matchCount: findMatches(req, 'client', listingsData, selectedAlgorithm).length // Pass algorithm
    }));
  }, [listingsData, requirementsData, selectedAlgorithm]); // Add selectedAlgorithm dependency

  // Filter based on transaction type *after* calculating counts
  const filteredListings = useMemo(() => {
    if (transactionTypeFilter === 'All') return listingsWithMatchCounts;
    return listingsWithMatchCounts.filter(listing => 
      listing.transaction_type && listing.transaction_type.toLowerCase() === transactionTypeFilter.toLowerCase()
    );
  }, [listingsWithMatchCounts, transactionTypeFilter]);

  const filteredRequirements = useMemo(() => {
    if (transactionTypeFilter === 'All') return requirementsWithMatchCounts;
    return requirementsWithMatchCounts.filter(req => 
      req.transaction_type && req.transaction_type.toLowerCase() === transactionTypeFilter.toLowerCase()
    );
  }, [requirementsWithMatchCounts, transactionTypeFilter]);

  // --- NEW: Effect to reset selections ONLY when filter changes --- 
  useEffect(() => {
    // Check if current listing selection is still valid under the new filter
    const selectedListing = listingsWithMatchCounts.find(listing => String(listing.pk) === selectedListingId);
    if (selectedListingId && selectedListing && transactionTypeFilter !== 'All' && 
        selectedListing.transaction_type?.toLowerCase() !== transactionTypeFilter.toLowerCase()) {
      console.log(`[Filter Reset] Clearing listing selection ${selectedListingId} due to filter change to ${transactionTypeFilter}`);
      setSelectedListingId('');
    }

    // Check if current requirement selection is still valid under the new filter
    const selectedRequirement = requirementsWithMatchCounts.find(req => String(req.pk) === selectedRequirementId);
    if (selectedRequirementId && selectedRequirement && transactionTypeFilter !== 'All' && 
        selectedRequirement.transaction_type?.toLowerCase() !== transactionTypeFilter.toLowerCase()) {
      console.log(`[Filter Reset] Clearing requirement selection ${selectedRequirementId} due to filter change to ${transactionTypeFilter}`);
      setSelectedRequirementId('');
    }
    // Note: We use listingsWithMatchCounts/requirementsWithMatchCounts here as filteredX might not yet be updated
    // This effect ONLY depends on the filter changing.
  }, [transactionTypeFilter, listingsWithMatchCounts, requirementsWithMatchCounts]); // Dependencies refined


  // --- Effect for Calculating Matches --- 
  useEffect(() => {
    console.log(`[useEffect] Calculating suggested matches. Source: ${selectedListingId || selectedRequirementId}, Algo: ${selectedAlgorithm}`);
    let sourceItem = null;
    let sourceItemType = '';
    let targetList = [];

    // Determine the source item and the list to compare against
    if (selectedRequirementId) {
      // Ensure comparison works even if pk is number and selectedRequirementId is string
      sourceItem = filteredRequirements.find(req => String(req.pk) === selectedRequirementId); 
      sourceItemType = 'client';
      targetList = filteredListings;
    } else if (selectedListingId) {
      // Ensure comparison works even if pk is number and selectedListingId is string
      sourceItem = filteredListings.find(listing => String(listing.pk) === selectedListingId); 
      sourceItemType = 'listing';
      targetList = filteredRequirements;
    }

    if (sourceItem && Array.isArray(targetList)) { // Added check for targetList
      console.log('[useEffect] Calling findMatches with:', sourceItem, sourceItemType, targetList.length, selectedAlgorithm);
      const matches = findMatches(sourceItem, sourceItemType, targetList, selectedAlgorithm); // Pass algorithm
      console.log('[useEffect] Matches found:', matches);
      setSuggestedMatches(matches || []); 
    } else {
      console.log('[useEffect] No source item or invalid target list, clearing matches.');
      setSuggestedMatches([]); 
    }

  }, [selectedListingId, selectedRequirementId, filteredListings, filteredRequirements, selectedAlgorithm, customRules]); // Add customRules dependency

  // --- NEW: Handlers for Selection Dropdowns ---
  const handleListingSelect = (e) => {
    const newListingId = e.target.value;
    setSelectedListingId(newListingId);
    if (newListingId) { // Restore cross-clearing
      setSelectedRequirementId('');
    }
  };

  const handleRequirementSelect = (e) => {
    const newRequirementId = e.target.value;
    setSelectedRequirementId(newRequirementId);
    if (newRequirementId) { // Restore cross-clearing
      setSelectedListingId('');
    }
  };


  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Error: {error}</div>;


  // --- Render Logic ---
  return (
    <div className="flex flex-col p-8 bg-background min-h-screen" data-component-name="MatchingPage">
      <h1 className="text-2xl font-bold mb-6 text-primary">Matching Engine</h1>

      {/* Manual Matching Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Manual Selection</h2>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-4 items-center mb-6">
          {/* Transaction Type Filter */}
          <div className="flex items-center space-x-2">
            <label htmlFor="transactionTypeFilter" className="text-sm font-medium text-gray-700">Transaction Type:</label>
            <select 
              id="transactionTypeFilter"
              value={transactionTypeFilter}
              onChange={(e) => setTransactionTypeFilter(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="All">All Types</option>
              <option value="Rent">Rent</option>
              <option value="Sale">Sale</option>
            </select>
          </div>

          {/* Algorithm Selector */}
          <div className="flex items-center space-x-2">
            <label htmlFor="algorithmSelector" className="text-sm font-medium text-gray-700">Matching Algorithm:</label>
            <select 
              id="algorithmSelector"
              value={selectedAlgorithm}
              onChange={(e) => setSelectedAlgorithm(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="exact">Exact Match</option>
              <option value="priority">Priority Match</option>
              <option value="exploratory">Exploratory Match</option>
              <option value="custom">Custom Match</option> {/* Enabled */}
            </select>
          </div>
        </div>

        {/* --- ADDED: Selection Dropdowns Row --- */}
        <div className="flex flex-wrap gap-4 items-start mb-6"> {/* Use items-start for alignment */}
            
            {/* Listing Selector */}
            <div className="flex-1 min-w-[200px]"> {/* Allow dropdowns to grow */}
              <label htmlFor="listingSelector" className="block text-sm font-medium text-gray-700 mb-1">Select Listing:</label>
              <select
                id="listingSelector"
                value={selectedListingId}
                onChange={handleListingSelect} // Use new handler
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                disabled={!listingsWithMatchCounts || listingsWithMatchCounts.length === 0} // Disable if no base listings
              >
                <option value="">-- Select a Listing --</option>
                {listingsWithMatchCounts.map((listing) => {
                  // Conditional rendering based on filter
                  const matchesFilter = transactionTypeFilter === 'All' || 
                                        (listing.transaction_type && listing.transaction_type.toLowerCase() === transactionTypeFilter.toLowerCase());
                  
                  if (!matchesFilter) return null; // Skip rendering if it doesn't match filter

                  return (
                    <option key={listing.pk} value={String(listing.pk)}> {/* Cast value to string */}
                      {/* Updated display text */}
                      Ref: {listing.property_ref_no || 'N/A'} - {listing.title || 'No Title'} ({listing.community || 'No Community'}) - Matches: {listing._matchCount}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Requirement Selector */}
            <div className="flex-1 min-w-[200px]"> {/* Allow dropdowns to grow */}
              <label htmlFor="requirementSelector" className="block text-sm font-medium text-gray-700 mb-1">Select Client Requirement:</label>
              <select
                id="requirementSelector"
                value={selectedRequirementId}
                onChange={handleRequirementSelect} // Use new handler
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                disabled={!requirementsWithMatchCounts || requirementsWithMatchCounts.length === 0} // Disable if no base requirements
              >
                <option value="">-- Select a Requirement --</option>
                {requirementsWithMatchCounts.map((req) => {
                   // Conditional rendering based on filter
                   const matchesFilter = transactionTypeFilter === 'All' || 
                                         (req.transaction_type && req.transaction_type.toLowerCase() === transactionTypeFilter.toLowerCase());

                   if (!matchesFilter) return null; // Skip rendering if it doesn't match filter

                  return (
                    <option key={req.pk} value={String(req.pk)}> {/* Cast value to string */}
                      {/* Basic display - enhance as needed */}
                      {req.pk} - {req.client_name || 'No Name'} ({req.property_type || 'Any Type'}) - Matches: {req._matchCount}
                    </option>
                  );
                })}
              </select>
            </div>
        </div>

        {/* Custom Rules Section (Only shown if algorithm is 'custom') */}
        {selectedAlgorithm === 'custom' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 p-4 border rounded bg-gray-50">
            <h3 className="md:col-span-3 text-lg font-semibold mb-2">Custom Match Rules</h3>
            
            {/* Unit Type */} 
            <div className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                id="customMatchUnitType"
                checked={customRules.matchUnitType}
                onChange={(e) => handleCustomRuleChange('matchUnitType', e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="customMatchUnitType" className="text-sm font-medium text-gray-700">Match Unit Type?</label>
            </div>

            {/* Community Matching */} 
            <div>
              <label htmlFor="customMatchCommunity" className="block text-sm font-medium text-gray-700 mb-1">Community Match:</label>
              <select 
                id="customMatchCommunity"
                value={customRules.matchCommunity}
                onChange={(e) => handleCustomRuleChange('matchCommunity', e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="strict">Strict (Must match, no NA)</option>
                <option value="flexible">Flexible (Match if specified, allow NA)</option>
                <option value="ignore">Ignore Community</option>
              </select>
            </div>

             {/* Bedrooms Matching */} 
            <div>
              <label htmlFor="customMatchBedrooms" className="block text-sm font-medium text-gray-700 mb-1">Bedrooms Match:</label>
              <select 
                id="customMatchBedrooms"
                value={customRules.matchBedrooms}
                onChange={(e) => handleCustomRuleChange('matchBedrooms', e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                <option value="strict">Strict (Exact match)</option>
                <option value="flexible">Flexible (+/- 1 Bed)</option>
                <option value="ignore">Ignore Bedrooms</option>
              </select>
            </div>

            {/* Price Tolerance */} 
            <div>
              <label htmlFor="customPriceTolerance" className="block text-sm font-medium text-gray-700 mb-1">Max Price Tolerance (%):</label>
              <input 
                type="number"
                id="customPriceTolerance"
                min="0"
                max="100"
                value={customRules.priceTolerancePercent}
                onChange={(e) => handleCustomRuleChange('priceTolerancePercent', parseInt(e.target.value, 10) || 0)}
                className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              />
            </div>

            {/* Size Tolerance */} 
            <div>
              <label htmlFor="customSizeTolerance" className="block text-sm font-medium text-gray-700 mb-1">Unit Size Tolerance (+/- %):</label>
              <input 
                type="number"
                id="customSizeTolerance"
                min="0"
                max="100"
                value={customRules.sizeTolerancePercent}
                onChange={(e) => handleCustomRuleChange('sizeTolerancePercent', parseInt(e.target.value, 10) || 0)}
                className="block w-full pl-3 pr-3 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              />
            </div>

          </div>
        )}

        {/* Selection and Display Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Column 1: Selected Items */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-lg font-semibold mb-3">Selected Item(s)</h3>
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-2 text-primary-foreground/80">Selected Listing</h2>
              {selectedListingId ? (
                <PropertyCard data={selectedListing} type="listing" /> 
              ) : (
                <div className="text-center p-4 border rounded-lg bg-muted text-muted-foreground">Select a listing to view details.</div>
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-2 text-primary-foreground/80">Selected Requirement</h2>
              {selectedRequirementId ? (
                <PropertyCard data={selectedRequirement} type="client" /> 
              ) : (
                <div className="text-center p-4 border rounded-lg bg-muted text-muted-foreground">Select a requirement to view details.</div>
              )}
            </div>
            {!selectedListingId && !selectedRequirementId && (
               <p className="text-sm text-gray-500 p-4 border rounded bg-gray-50">Select a listing or requirement above to view details.</p>
            )}
          </div>

          {/* Column 2: Suggested Matches */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold mb-3">Suggested Matches ({suggestedMatches.length})</h3>
            {suggestedMatches.length > 0 ? (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"> 
                {suggestedMatches.map(match => (
                  <PropertyCard 
                    key={match.pk} 
                    data={match} 
                    type={selectedRequirementId ? 'listing' : 'client'} 
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 p-4 border rounded bg-gray-50">
                {(selectedListingId || selectedRequirementId) ? 
                'No matching items found based on the criteria.' : 
                'Matching suggestions will appear here once an item is selected.'
              }</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MatchingPage;
