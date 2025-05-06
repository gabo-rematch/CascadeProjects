import { useState } from 'react';
import Papa from 'papaparse';
import { Button, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface CsvRow {
  phoneNumber: string;
  messageBody: string;
  [key: string]: string; // Allow other columns, though we only care about these two
}

interface CsvUploadComponentProps {
  onCsvDataParsed: (data: CsvRow[], fileName: string) => void;
}

const CsvUploadComponent: React.FC<CsvUploadComponentProps> = ({ onCsvDataParsed }) => {
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);

    if (file) {
      Papa.parse<CsvRow>(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true, // convert numbers and booleans
        complete: (results) => {
          if (results.errors.length > 0) {
            console.error("Parsing errors:", results.errors);
            setError(`Error parsing CSV: ${results.errors.map(e => e.message).join(', ')}`);
            onCsvDataParsed([], file.name); // Pass empty array on error
            return;
          }
          
          const requiredColumns = ['phoneNumber', 'messageBody'];
          // Check if data is empty which can happen if the file is empty or only has headers
          if (results.data.length === 0) {
            setError("The CSV file is empty or contains no data rows after the header.");
            onCsvDataParsed([], file.name);
            return;
          }

          const actualHeaders = Object.keys(results.data[0] || {});
          const missingColumns = requiredColumns.filter(col => !actualHeaders.includes(col));

          if (missingColumns.length > 0) {
            setError(`Missing required columns: ${missingColumns.join(', ')}. Please ensure the CSV has 'phoneNumber' and 'messageBody' columns.`);
            onCsvDataParsed([], file.name);
            return;
          }
          
          const validData = results.data.filter(
            row => row.phoneNumber != null && row.messageBody != null && String(row.phoneNumber).trim() !== "" && String(row.messageBody).trim() !== ""
          );

          if (validData.length === 0 && results.data.length > 0) {
             setError("No valid data rows found with non-empty 'phoneNumber' and 'messageBody'.");
             onCsvDataParsed([], file.name);
             return;
          }
          // The following check is essentially covered if validData is empty and results.data was also empty.
          // if (validData.length === 0 && results.data.length === 0) { 
          //   setError("The CSV file is empty or contains no data rows.");
          //   onCsvDataParsed([], file.name);
          //   return;
          // }

          onCsvDataParsed(validData, file.name);
        },
        error: (err) => {
          console.error("PapaParse error:", err);
          setError(`Failed to parse CSV file: ${err.message}`);
          onCsvDataParsed([], file.name);
        }
      });
    }
  };

  return (
    <div>
      <Button
        component="label"
        variant="contained"
        startIcon={<CloudUploadIcon />}
        sx={{ marginBottom: 2 }}
      >
        Upload CSV
        <input type="file" accept=".csv" hidden onChange={handleFileChange} />
      </Button>
      {error && <Typography color="error" variant="body2">{error}</Typography>}
    </div>
  );
};

export default CsvUploadComponent;
export type { CsvRow };
