import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box
} from '@mui/material';
import type { CsvRow } from './CsvUploadComponent'; // Import the CsvRow type

interface MessageTableComponentProps {
  data: CsvRow[];
  fileName: string | null;
}

const MessageTableComponent: React.FC<MessageTableComponentProps> = ({ data, fileName }) => {
  if (!fileName) {
    return null; // Don't render anything if no file has been uploaded yet
  }

  if (data.length === 0) {
    return (
      <Typography variant="subtitle1" sx={{ marginTop: 2, color: 'text.secondary' }}>
        No valid data to display from {fileName}. Please check the file for 'phoneNumber' and 'messageBody' columns and ensure they have values.
      </Typography>
    );
  }

  return (
    <Box sx={{ marginTop: 2 }}>
      <Typography variant="h6" gutterBottom>
        Preview of: {fileName} ({data.length} rows)
      </Typography>
      <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
        <Table stickyHeader aria-label="csv data table">
          <TableHead>
            <TableRow>
              <TableCell sx={{fontWeight: 'bold'}}>Row #</TableCell>
              <TableCell sx={{fontWeight: 'bold'}}>Phone Number</TableCell>
              <TableCell sx={{fontWeight: 'bold'}}>Message Body</TableCell>
              {/* Add other headers if you want to display more columns from CsvRow */}
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>{row.phoneNumber}</TableCell>
                <TableCell>{row.messageBody}</TableCell>
                {/* Add other cells if you want to display more columns */}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default MessageTableComponent;
