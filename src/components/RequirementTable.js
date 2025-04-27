import React from "react";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";

function RequirementTable({ requirements, columns = [], selected, onSelect }) {
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
          {requirements.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length}>No requirements</TableCell>
            </TableRow>
          ) : (
            requirements.map(req => (
              <TableRow
                key={req.id || req[columns[0]]}
                hover
                selected={selected && (selected.id === req.id || selected[columns[0]] === req[columns[0]])}
                onClick={() => onSelect(req)}
                style={{ cursor: "pointer" }}
              >
                {columns.map(col => (
                  <TableCell key={col}>{req[col]?.toString() || "-"}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default RequirementTable;
