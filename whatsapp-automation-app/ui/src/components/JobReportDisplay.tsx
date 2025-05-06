import React from 'react';
import type { JobReport, MessageReportItem } from '../App'; // Assuming interfaces are exported from App.tsx or a shared types file
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';

interface JobReportDisplayProps {
  report: JobReport | null;
}

const JobReportDisplay: React.FC<JobReportDisplayProps> = ({ report }) => {
  if (!report) {
    return null; // Don't render anything if there's no report
  }

  const { summary, details } = report;

  return (
    <Paper elevation={3} sx={{ mt: 4, p: 3 }}>
      <Typography variant="h5" component="h2" gutterBottom sx={{ textAlign: 'center' }}>
        Job Processing Report
      </Typography>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 2, textAlign: 'center' }}>
        <Box>
          <Typography variant="h6">{summary.totalMessages}</Typography>
          <Typography color="text.secondary">Total Messages</Typography>
        </Box>
        <Box>
          <Typography variant="h6" color="success.main">{summary.successCount}</Typography>
          <Typography color="text.secondary">Successfully Sent</Typography>
        </Box>
        <Box>
          <Typography variant="h6" color="error.main">{summary.failureCount}</Typography>
          <Typography color="text.secondary">Failed to Send</Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" component="h3" gutterBottom sx={{ mt: 3 }}>
        Detailed Results
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table sx={{ minWidth: 650 }} aria-label="job report details table">
          <TableHead>
            <TableRow>
              <TableCell>Phone Number</TableCell>
              <TableCell>Message Snippet</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Timestamp</TableCell>
              <TableCell>Details/Error</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {details.map((item: MessageReportItem, index: number) => (
              <TableRow
                key={`${item.phoneNumber}-${index}`}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
              >
                <TableCell component="th" scope="row">
                  {item.phoneNumber}
                </TableCell>
                <TableCell>{item.messageBodySnippet}</TableCell>
                <TableCell>
                  <Chip 
                    label={item.status}
                    color={item.status === 'Sent' ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{new Date(item.timestamp).toLocaleString()}</TableCell>
                <TableCell sx={{ maxWidth: 200, overflowWrap: 'break-word', wordWrap: 'break-word' }}>
                  {item.error || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default JobReportDisplay;
