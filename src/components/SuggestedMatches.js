import React from "react";
import { Box } from "@mui/material";
import MatchComparisonCard from "./MatchComparisonCard";

function SuggestedMatches({ suggestions }) {
  if (!suggestions.length) return <div>No suggestions yet.</div>;
  return (
    <Box>
      {suggestions.map(({ requirement, listings }) =>
        listings.length === 0 ? (
          <Box key={requirement.id || Math.random()} sx={{ mb: 2 }}>
            No suggested listings for this requirement.
          </Box>
        ) : (
          listings.map(listing => (
            <MatchComparisonCard
              key={requirement.id + "-" + (listing.id || Math.random())}
              requirement={requirement}
              listing={listing}
              onReject={() => {}}
            />
          ))
        )
      )}
    </Box>
  );
}

export default SuggestedMatches;
