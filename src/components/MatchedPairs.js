import React from "react";
import { List, ListItem, ListItemText, IconButton } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

function MatchedPairs({ matches, onUnmatch }) {
  if (!matches.length) return <div>No matches yet.</div>;
  return (
    <List dense>
      {matches.map((pair, idx) => (
        <ListItem
          key={pair.requirement.id + "-" + pair.listing.id}
          secondaryAction={
            <IconButton edge="end" aria-label="unmatch" onClick={() => onUnmatch(idx)}>
              <DeleteIcon />
            </IconButton>
          }
        >
          <ListItemText
            primary={`Requirement: ${pair.requirement.name || pair.requirement.id} ↔ Listing: ${pair.listing.name || pair.listing.id}`}
          />
        </ListItem>
      ))}
    </List>
  );
}

export default MatchedPairs;
