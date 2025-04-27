import React, { useEffect, useState } from "react";
import { Box, Grid, Paper, Typography, CircularProgress, Alert, Tabs, Tab, Divider } from "@mui/material";
import RequirementTable from "./RequirementTable";
import ListingTable from "./ListingTable";
import SuggestedMatches from "./SuggestedMatches";
import MatchedPairs from "./MatchedPairs";
import { fetchTableData, fetchTableColumnsFromRows } from "../supabaseClient";

const REQUIREMENTS_TABLE = "wa_group_client_reqs";
const LISTINGS_TABLE = "wa_group_listings";

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 2 }}>{children}</Box> : null;
}

function MatchingDashboard() {
  const [requirements, setRequirements] = useState([]);
  const [requirementCols, setRequirementCols] = useState([]);
  const [listings, setListings] = useState([]);
  const [listingCols, setListingCols] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedRequirement, setSelectedRequirement] = useState(null);
  const [selectedListing, setSelectedListing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_KEY) {
      setError("Supabase credentials are missing. Please set them in your .env file.");
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const [reqData, reqCols, listData, listCols] = await Promise.all([
          fetchTableData(REQUIREMENTS_TABLE),
          fetchTableColumnsFromRows(REQUIREMENTS_TABLE),
          fetchTableData(LISTINGS_TABLE),
          fetchTableColumnsFromRows(LISTINGS_TABLE),
        ]);
        setRequirements(reqData || []);
        setRequirementCols(reqCols || []);
        setListings(listData || []);
        setListingCols(listCols || []);
      } catch (e) {
        setError(e.message || "Failed to fetch data from Supabase.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Placeholder for suggested matches
  const suggestedMatches = requirements.map(req => ({
    requirement: req,
    listings: listings.slice(0, 2)
  }));

  return (
    <Box sx={{ mt: 2 }}>
      {loading && <CircularProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Client Requirements</Typography>
            <RequirementTable
              requirements={requirements}
              columns={requirementCols}
              selected={selectedRequirement}
              onSelect={setSelectedRequirement}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Listings</Typography>
            <ListingTable
              listings={listings}
              columns={listingCols}
              selected={selectedListing}
              onSelect={setSelectedListing}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} md={2}>
          <Paper sx={{ p: 2, minHeight: 200 }}>
            <Typography variant="h6">Manual Match</Typography>
            <Box sx={{ my: 2 }}>
              <Typography variant="body2">
                Select a requirement and a listing, then click Match.
              </Typography>
              <button
                disabled={!selectedRequirement || !selectedListing}
                onClick={() => {
                  if (selectedRequirement && selectedListing) {
                    setMatches([...matches, { requirement: selectedRequirement, listing: selectedListing }]);
                    setSelectedRequirement(null);
                    setSelectedListing(null);
                  }
                }}
              >
                Match
              </button>
            </Box>
            <MatchedPairs matches={matches} onUnmatch={idx => setMatches(matches.filter((_, i) => i !== idx))} />
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="h6">Suggested Matches</Typography>
            <SuggestedMatches suggestions={suggestedMatches} />
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default MatchingDashboard;
