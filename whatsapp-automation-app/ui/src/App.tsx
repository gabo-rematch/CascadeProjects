import { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import dayjs, { Dayjs } from 'dayjs';

import CsvUploadComponent, { type CsvRow } from './components/CsvUploadComponent';
import MessageTableComponent from './components/MessageTableComponent';
import SettingsComponent from './components/SettingsComponent';
import JobReportDisplay from './components/JobReportDisplay';

// Backend API endpoint
const API_ENDPOINT = 'http://localhost:3001/api/submit-job';

// Interfaces from backend (message-sender.ts)
export interface MessageReportItem {
  phoneNumber: string;
  messageBodySnippet: string;
  status: 'Sent' | 'Failed';
  error?: string;
  timestamp: string;
}

export interface JobReport {
  summary: {
    successCount: number;
    failureCount: number;
    totalMessages: number;
  };
  details: MessageReportItem[];
}

// A simple dark theme, you can customize this later
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

// Default values for settings
const DEFAULT_MIN_DELAY_MS = 2000;
const DEFAULT_MAX_DELAY_MS = 10000;
const DEFAULT_API_KEY = '852344446D36B23DEBF3A33C1DEAFB05'; // From memory
const DEFAULT_INSTANCE_NAME = '+447435406281'; // From memory

function App() {
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // State for SettingsComponent
  const [minDelay, setMinDelay] = useState<number>(DEFAULT_MIN_DELAY_MS);
  const [maxDelay, setMaxDelay] = useState<number>(DEFAULT_MAX_DELAY_MS);
  const [scheduleDateTime, setScheduleDateTime] = useState<Dayjs | null>(dayjs().add(1, 'hour'));
  const [apiKey, setApiKey] = useState<string>(DEFAULT_API_KEY);
  const [instanceName, setInstanceName] = useState<string>(DEFAULT_INSTANCE_NAME);
  
  // State for API call status
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiStatusMessage, setApiStatusMessage] = useState<string>('');
  const [jobReport, setJobReport] = useState<JobReport | null>(null);

  const handleDataParsed = (data: CsvRow[], fileName: string) => {
    setCsvData(data);
    setUploadedFileName(fileName);
    setApiStatusMessage(''); // Clear status on new CSV upload
    setJobReport(null); // Clear previous report on new CSV upload
  };

  // Handlers for SettingsComponent props
  const handleMinDelayChange = (value: number) => {
    // Basic validation, more complex logic can be added if needed
    setMinDelay(value < 0 ? 0 : value);
  };

  const handleMaxDelayChange = (value: number) => {
    setMaxDelay(value < 0 ? 0 : value);
  };

  const handleScheduleDateTimeChange = (value: Dayjs | null) => {
    setScheduleDateTime(value);
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
  };

  const handleInstanceNameChange = (value: string) => {
    setInstanceName(value);
  };

  const handleSubmitJob = async (runNow: boolean) => {
    setApiStatusMessage('');
    setJobReport(null); // Clear previous report before new submission

    if (csvData.length === 0) {
      setApiStatusMessage('Please upload a CSV file with messages.');
      return;
    }
    if (!apiKey.trim()) {
      setApiStatusMessage('API Key is required.');
      return;
    }
    if (!instanceName.trim()) {
      setApiStatusMessage('Instance Name is required.');
      return;
    }
    if (minDelay < 0 || maxDelay < 0) {
      setApiStatusMessage('Delay values cannot be negative.');
      return;
    }
    if (minDelay > maxDelay) {
      setApiStatusMessage('Minimum delay cannot be greater than maximum delay.');
      return;
    }

    let effectiveScheduleDateTime: string | null = null;

    if (!runNow) { // Validations for scheduled job only
      if (!scheduleDateTime || !scheduleDateTime.isValid()) {
        setApiStatusMessage('Invalid schedule date/time for a scheduled job.');
        return;
      }
      if (scheduleDateTime.isBefore(dayjs())) {
        setApiStatusMessage('Cannot schedule a job in the past.');
        return;
      }
      effectiveScheduleDateTime = scheduleDateTime.toISOString();
    }

    setIsLoading(true);
    setApiStatusMessage('Submitting job...');

    const payload = {
      csvData: csvData.map(row => ({ phoneNumber: row.phoneNumber, messageBody: row.messageBody })),
      minDelay,
      maxDelay,
      scheduleDateTime: effectiveScheduleDateTime, // Will be null if runNow is true
      apiKey,
      instanceName,
      runNow, // Add the runNow flag to the payload
    };

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (response.ok) {
        setApiStatusMessage(responseData.message || 'Job request processed!');
        if (response.status === 200 && responseData.report) {
          setJobReport(responseData.report as JobReport);
        } else {
          // For 202 (Accepted/Scheduled) or if report is missing for some reason on 200
          setJobReport(null);
        }
      } else {
        setApiStatusMessage(`Error: ${responseData.message || response.statusText || 'Unknown error'}`);
        setJobReport(null);
      }
    } catch (error) {
      console.error('Failed to submit job:', error);
      setApiStatusMessage(`Network error: Failed to connect to the server. Is it running at ${API_ENDPOINT}?`);
      setJobReport(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  const canSubmitGenerally = csvData.length > 0 && apiKey.trim() !== '' && instanceName.trim() !== '';
  const canSchedule = canSubmitGenerally && scheduleDateTime && scheduleDateTime.isValid() && scheduleDateTime.isAfter(dayjs());

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            WhatsApp Message Sender
          </Typography>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Upload Message Schedule
          </Typography>
          <CsvUploadComponent onCsvDataParsed={handleDataParsed} />
          <MessageTableComponent data={csvData} fileName={uploadedFileName} />
          
          <Divider sx={{ my: 4 }} />
          
          <SettingsComponent 
            minDelay={minDelay}
            onMinDelayChange={handleMinDelayChange}
            maxDelay={maxDelay}
            onMaxDelayChange={handleMaxDelayChange}
            scheduleDateTime={scheduleDateTime}
            onScheduleDateTimeChange={handleScheduleDateTimeChange}
            apiKey={apiKey}
            onApiKeyChange={handleApiKeyChange}
            instanceName={instanceName}
            onInstanceNameChange={handleInstanceNameChange}
          />
          
          <Box sx={{ mt: 3, mb: 2, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 2 }}>
            <Button 
              variant="contained" 
              color="secondary" 
              onClick={() => handleSubmitJob(true)} 
              disabled={isLoading || !canSubmitGenerally}
              size="large"
            >
              {isLoading ? 'Processing...' : 'Run Job Now'}
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => handleSubmitJob(false)} 
              disabled={isLoading || !canSchedule}
              size="large"
            >
              {isLoading ? 'Processing...' : 'Schedule Job'}
            </Button>
          </Box>

          {apiStatusMessage && (
            <Typography color={jobReport || (apiStatusMessage.toLowerCase().includes('scheduled') && !apiStatusMessage.toLowerCase().includes('error')) ? "text.secondary" : "error"} sx={{ mt: 2, textAlign: 'center' }}>
              {apiStatusMessage}
            </Typography>
          )}

          {jobReport && <JobReportDisplay report={jobReport} />}

        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
