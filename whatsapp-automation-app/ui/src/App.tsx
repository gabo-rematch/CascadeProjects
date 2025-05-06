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

// Backend API endpoint
const API_ENDPOINT = 'http://localhost:3001/api/submit-job';

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
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [apiStatusMessage, setApiStatusMessage] = useState<string>('');

  const handleDataParsed = (data: CsvRow[], fileName: string) => {
    setCsvData(data);
    setUploadedFileName(fileName);
    setApiStatusMessage(''); // Clear status on new CSV upload
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

  const handleSubmitJob = async () => {
    setApiStatusMessage('');
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
    if (scheduleDateTime && !scheduleDateTime.isValid()) {
      setApiStatusMessage('Invalid schedule date/time.');
      return;
    }
    if (scheduleDateTime && scheduleDateTime.isBefore(dayjs())) {
      setApiStatusMessage('Cannot schedule a job in the past.');
      return;
    }

    setIsSubmitting(true);
    setApiStatusMessage('Submitting job...');

    const payload = {
      csvData: csvData.map(row => ({ phoneNumber: row.phoneNumber, messageBody: row.messageBody })),
      minDelay,
      maxDelay,
      scheduleDateTime: scheduleDateTime ? scheduleDateTime.toISOString() : null,
      apiKey,
      instanceName,
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
        setApiStatusMessage(responseData.message || 'Job submitted successfully!');
        // Optionally clear CSV data after successful submission
        // setCsvData([]);
        // setUploadedFileName(null);
      } else {
        setApiStatusMessage(`Error: ${responseData.message || response.statusText || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to submit job:', error);
      setApiStatusMessage(`Network error: Failed to connect to the server. Is it running at ${API_ENDPOINT}?`);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const canSubmit = csvData.length > 0 && apiKey.trim() !== '' && instanceName.trim() !== '';

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
          
          <Box sx={{ mt: 3, mb: 2, textAlign: 'center' }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleSubmitJob} 
              disabled={isSubmitting || !canSubmit}
              size="large"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Job to Backend'}
            </Button>
          </Box>

          {apiStatusMessage && (
            <Typography 
              variant="body1" 
              sx={{ 
                mt: 2, 
                textAlign: 'center', 
                color: apiStatusMessage.toLowerCase().includes('error') || apiStatusMessage.toLowerCase().includes('failed') ? 'error.main' : 'success.main', 
                padding: 1,
                borderRadius: 1,
                backgroundColor: apiStatusMessage.toLowerCase().includes('error') || apiStatusMessage.toLowerCase().includes('failed') ? 'rgba(211, 47, 47, 0.1)' : 'rgba(46, 125, 50, 0.1)'
              }}
            >
              {apiStatusMessage}
            </Typography>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
