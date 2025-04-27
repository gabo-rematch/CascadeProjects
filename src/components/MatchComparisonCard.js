import React from "react";
import { Card, CardContent, Grid, Typography, Chip, Button, Box, Divider } from "@mui/material";

function renderField(label, value, boldValue = false) {
  return (
    <Grid container spacing={1} alignItems="center" sx={{ mb: 1 }}>
      <Grid item xs={6}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="body2" fontWeight={boldValue ? 700 : 400}>{value || 'N/A'}</Typography>
      </Grid>
    </Grid>
  );
}

export default function MatchComparisonCard({ requirement, listing, onReject, matchScore = 100, type = "Sale" }) {
  // Map your actual DB fields here:
  const req = requirement || {};
  const list = listing || {};
  // Example field mapping (adjust as needed):
  // req.price_min, req.price_max, req.bedrooms, req.community, req.unit_type, req.agency
  // list.price, list.area, list.bedrooms, list.community, list.unit_type, list.agency, list.amenities (array), list.image_url

  return (
    <Card sx={{ mb: 3, p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
          Match Score: {matchScore}%
        </Typography>
        <Typography variant="body2" sx={{ mr: 2 }}>{type}</Typography>
        <Button variant="outlined" color="error" onClick={onReject}>Reject</Button>
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Grid container spacing={2}>
        {/* Lead Requirements */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" sx={{ mb: 2 }}>Lead Requirements</Typography>
          {renderField("Price Range", req.price_min && req.price_max ? `AED ${req.price_min} - AED ${req.price_max}` : "N/A", true)}
          {renderField("Unit Area", req.unit_area)}
          {renderField("Bedrooms", req.bedrooms)}
          {renderField("Community", req.community)}
          {renderField("Unit Type", req.unit_type)}
          {renderField("Agency", req.agency)}
        </Grid>
        {/* Listing */}
        <Grid item xs={12} md={6}>
          <Typography variant="h6" sx={{ mb: 2 }}>Listing</Typography>
          {renderField("Price", list.price, true)}
          {renderField("Unit Area", list.area, true)}
          {renderField("Bedrooms", list.bedrooms)}
          {renderField("Community", list.community)}
          {renderField("Unit Type", list.unit_type)}
          {renderField("Agency", list.agency)}
          {/* Amenities */}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Amenities</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {(list.amenities || []).map((a, i) => (
              <Chip key={a || i} label={a} size="small" />
            ))}
          </Box>
          {/* Image */}
          {list.image_url && (
            <Box sx={{ mt: 2 }}>
              <img src={list.image_url} alt={list.title || 'Listing'} style={{ maxWidth: '100%', borderRadius: 8 }} />
            </Box>
          )}
        </Grid>
      </Grid>
    </Card>
  );
}
