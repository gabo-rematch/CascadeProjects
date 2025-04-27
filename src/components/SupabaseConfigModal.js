import React, { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box } from "@mui/material";
import { setSupabaseConfig } from "../supabaseClient";

function SupabaseConfigModal({ open, onClose }) {
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [tables, setTables] = useState([]);
  const [fetching, setFetching] = useState(false);
  const [columns, setColumns] = useState({});
  const [error, setError] = useState("");

  // Try to fetch tables when user clicks "Show Tables"
  const handleFetchTables = async () => {
    setError("");
    setFetching(true);
    setSupabaseConfig(url, apiKey);
    try {
      const tableNames = await fetchTableNames();
      setTables(tableNames);
      // Fetch columns for each table
      const columnsObj = {};
      for (const t of tableNames) {
        columnsObj[t] = await fetchTableColumns(t);
      }
      setColumns(columnsObj);
    } catch (error) {
      setError(error.message);
    } finally {
      setFetching(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Supabase Configuration</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Supabase URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Box>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </Box>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={fetching}>Cancel</Button>
        <Button onClick={handleFetchTables} disabled={fetching}>Show Tables</Button>
      </DialogActions>
    </Dialog>
  );
}

export default SupabaseConfigModal;

