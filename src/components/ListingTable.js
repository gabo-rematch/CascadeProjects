import React from "react";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";

function ListingTable({ listings, columns = [], selected, onSelect }) {
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map(col => (
              <TableCell key={col}>{col}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {listings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length}>No listings</TableCell>
            </TableRow>
          ) : (
            listings.map(listing => (
              <TableRow
                key={listing.id || listing[columns[0]]}
                hover
                selected={selected && (selected.id === listing.id || selected[columns[0]] === listing[columns[0]])}
                onClick={() => onSelect(listing)}
                style={{ cursor: "pointer" }}
              >
                {columns.map(col => (
                  <TableCell key={col}>{listing[col]?.toString() || "-"}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default ListingTable;
