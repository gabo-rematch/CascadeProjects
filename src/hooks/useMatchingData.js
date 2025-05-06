import { useState, useCallback, useEffect } from 'react';
import { getSupabaseClient } from '../supabaseClient';

const supabase = getSupabaseClient();

/**
 * Custom hook to fetch listings and requirements based on transaction type.
 * @param {string} transactionTypeFilter - 'all', 'sale', or 'rent'.
 * @returns {object} - Listings, requirements, loading states, errors, and fetch functions.
 */
export const usePropertyData = (transactionTypeFilter) => {
  const [listings, setListings] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(false);
  const [errorListings, setErrorListings] = useState(null);
  const [errorRequirements, setErrorRequirements] = useState(null);

  // Fetch Listings
  const fetchListings = useCallback(async () => {
    setIsLoadingListings(true);
    setErrorListings(null);
    try {
      let query = supabase.from('wa_group_listings').select('*');
      if (transactionTypeFilter !== 'all') {
        query = query.eq('transaction_type', transactionTypeFilter);
      }
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Error fetching listings:', error);
      setErrorListings(error.message);
    } finally {
      setIsLoadingListings(false);
    }
  }, [supabase, transactionTypeFilter]);

  // Fetch Requirements
  const fetchRequirements = useCallback(async () => {
    setIsLoadingRequirements(true);
    setErrorRequirements(null);
    try {
      let query = supabase.from('wa_group_client_reqs').select('*');
      if (transactionTypeFilter !== 'all') {
        query = query.eq('transaction_type', transactionTypeFilter);
      }
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setRequirements(data || []);
    } catch (error) {
      console.error('Error fetching requirements:', error);
      setErrorRequirements(error.message);
    } finally {
      setIsLoadingRequirements(false);
    }
  }, [supabase, transactionTypeFilter]);

  // Effect to fetch data when filter changes
  useEffect(() => {
    fetchListings();
    fetchRequirements();
  }, [fetchListings, fetchRequirements]); // Depend on the useCallback functions

  return {
    listings,
    requirements,
    isLoadingListings,
    isLoadingRequirements,
    errorListings,
    errorRequirements,
    fetchListings, // Expose if needed externally, though useEffect handles internal calls
    fetchRequirements, // Expose if needed externally
  };
};

/**
 * Custom hook to fetch match counts for all listings and requirements.
 * @param {string} selectedAlgorithm - The ID of the matching algorithm.
 * @param {string} transactionTypeFilter - 'all', 'sale', or 'rent'.
 * @param {object} customCriteria - Custom criteria for the 'custom' algorithm.
 * @returns {object} - Listing counts, requirement counts, loading state, error state.
 */
export const useMatchCounts = (selectedAlgorithm, transactionTypeFilter, customCriteria) => {
  const [listingMatchCounts, setListingMatchCounts] = useState(null);
  const [requirementMatchCounts, setRequirementMatchCounts] = useState(null);
  const [isLoadingMatchCounts, setIsLoadingMatchCounts] = useState(false);
  const [errorMatchCounts, setErrorMatchCounts] = useState(null);
  const supabase = getSupabaseClient(); // Get Supabase client

  // Fetch match counts for all listings and requirements based on filters
  const fetchCounts = useCallback(async () => {
    setIsLoadingMatchCounts(true);
    setErrorMatchCounts(null);
    setListingMatchCounts({}); // Clear previous counts
    setRequirementMatchCounts({});

    try {
      // Define the two RPC calls, explicitly passing all required params
      const baseParams = {
        p_source_pk: null, // Pass null when fetching counts for all listings
        p_source_type: 'listing',
        p_match_algorithm: selectedAlgorithm, // Pass required param
        p_transaction_filter: transactionTypeFilter.toUpperCase() === 'ALL' ? 'All' : transactionTypeFilter.charAt(0).toUpperCase() + transactionTypeFilter.slice(1) // Ensure correct case
      };

      let rpcParams;

      if (selectedAlgorithm === 'custom') {
        // For 'custom', pass the criteria object
        rpcParams = {
          ...baseParams,
          p_custom_criteria: customCriteria, // Pass the criteria object
        };
      } else {
        // For other algorithms, pass null for criteria
        rpcParams = {
          ...baseParams,
          p_custom_criteria: null, // Pass null
        };
      }

      const fetchListingCounts = supabase.rpc('get_match_counts', rpcParams);
      const fetchRequirementCounts = supabase.rpc('get_match_counts', {
        p_source_pk: null, // Pass null when fetching counts for all requirements
        p_source_type: 'requirement',
        p_match_algorithm: selectedAlgorithm, // Pass required param
        p_transaction_filter: transactionTypeFilter.toUpperCase() === 'ALL' ? 'All' : transactionTypeFilter.charAt(0).toUpperCase() + transactionTypeFilter.slice(1) // Ensure correct case
      });

      // Execute calls concurrently
      const [listingsResult, requirementsResult] = await Promise.all([
        fetchListingCounts,
        fetchRequirementCounts
      ]);

      // Check for errors in each call
      if (listingsResult.error) throw listingsResult.error;
      if (requirementsResult.error) throw requirementsResult.error;

      // Process listing counts
      const newListingCounts = {};
      (listingsResult.data || []).forEach(item => {
        // Assuming the function returns source_pk and match_count for listings
        newListingCounts[item.source_pk] = item.match_count;
      });
      setListingMatchCounts(newListingCounts);

      // Process requirement counts
      const newRequirementCounts = {};
      (requirementsResult.data || []).forEach(item => {
         // Assuming the function returns source_pk and match_count for requirements
        newRequirementCounts[item.source_pk] = item.match_count;
      });
      setRequirementMatchCounts(newRequirementCounts);

    } catch (error) {
      console.error('Error fetching match counts:', error);
      setErrorMatchCounts(error.message);
      // Already cleared counts at the start
    } finally {
      setIsLoadingMatchCounts(false);
    }
  }, [supabase, selectedAlgorithm, transactionTypeFilter, customCriteria]); // Add dependencies

  // Effect to trigger fetch when dependencies change
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]); // Run effect when fetchCounts changes (due to dependencies)

  return {
    listingMatchCounts,
    requirementMatchCounts,
    isLoadingMatchCounts,
    errorMatchCounts,
    fetchMatchCounts: fetchCounts // Expose fetch function if manual refresh is needed
  };
};

/**
 * Custom hook to fetch matches for a specific source item.
 * @param {string} selectedAlgorithm - The ID of the matching algorithm.
 * @param {string} transactionTypeFilter - 'all', 'sale', or 'rent'.
 * @param {object} customCriteria - Custom criteria for the 'custom' algorithm.
 * @returns {object} - Matches, loading state, error state, and fetch function.
 */
export const useMatches = (selectedAlgorithm, transactionTypeFilter, customCriteria) => {
  const [matches, setMatches] = useState([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [errorMatches, setErrorMatches] = useState(null);

  // Note: No useEffect here to auto-fetch. Fetching is triggered manually.
  const fetchMatches = useCallback(async (sourceId, sourceType) => {
    if (!sourceId || !sourceType) {
      setMatches([]); // Clear if no valid source
      setIsLoadingMatches(false);
      setErrorMatches(null);
      return;
    }

    setIsLoadingMatches(true);
    setErrorMatches(null);
    try {
      // Prepare base parameters
      const baseParams = {
        p_source_pk: parseInt(sourceId),
        p_source_type: sourceType,
        p_match_algorithm: selectedAlgorithm,
        p_transaction_filter: transactionTypeFilter.toUpperCase() === 'ALL' ? 'All' : transactionTypeFilter.charAt(0).toUpperCase() + transactionTypeFilter.slice(1) // Ensure correct case
      };

      let rpcParams;

      if (selectedAlgorithm === 'custom') {
        // For 'custom', pass the criteria object
        rpcParams = {
          ...baseParams,
          p_custom_criteria: customCriteria, // Pass the criteria object
        };
      } else {
        // For other algorithms, pass null for criteria
        rpcParams = {
          ...baseParams,
          p_custom_criteria: null, // Pass null
        };
      }

      const { data, error } = await supabase.rpc('get_matches', rpcParams);

      console.log(`[useMatches] Raw data for ${sourceType} ${sourceId}:`, data);
      console.log(`[useMatches] Raw error for ${sourceType} ${sourceId}:`, error);

      if (error) throw error;
      setMatches(data || []);
    } catch (error) {
      console.error(`Error fetching matches for ${sourceType} ${sourceId}:`, error);
      setErrorMatches(error.message);
      setMatches([]); // Clear matches on error
    } finally {
      setIsLoadingMatches(false);
    }
  }, [supabase, selectedAlgorithm, transactionTypeFilter, customCriteria]); // Dependencies for the fetch logic

  // Function to clear matches manually if needed (e.g., when selection is cleared)
  const clearMatches = useCallback(() => {
      setMatches([]);
      setIsLoadingMatches(false);
      setErrorMatches(null);
  }, []);

  return {
    matches,
    isLoadingMatches,
    errorMatches,
    fetchMatches, // Expose the fetch function to be called by the component
    clearMatches, // Expose the clear function
  };
};
