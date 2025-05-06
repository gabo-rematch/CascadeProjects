import { useState } from 'react';
import { Box, TextField, Typography, Grid } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';

interface SettingsComponentProps {
  minDelay: number;
  onMinDelayChange: (value: number) => void;
  maxDelay: number;
  onMaxDelayChange: (value: number) => void;
  scheduleDateTime: Dayjs | null;
  onScheduleDateTimeChange: (value: Dayjs | null) => void;
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  instanceName: string;
  onInstanceNameChange: (value: string) => void;
}

const SettingsComponent: React.FC<SettingsComponentProps> = ({
  minDelay,
  onMinDelayChange,
  maxDelay,
  onMaxDelayChange,
  scheduleDateTime,
  onScheduleDateTimeChange,
  apiKey,
  onApiKeyChange,
  instanceName,
  onInstanceNameChange,
}) => {
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleMinDelayInput = (value: string) => {
    const numericValue = parseInt(value, 10);
    if (isNaN(numericValue)) {
      onMinDelayChange(0); // Or some default / keep previous valid
      return;
    }
    if (numericValue < 0) {
      setStatusMessage('Delay values cannot be negative.');
      onMinDelayChange(numericValue); // Allow to show error, App.tsx might clamp
      return;
    }
    if (numericValue > maxDelay && maxDelay > 0) { // maxDelay > 0 ensures we don't trigger this if maxDelay is also being set to 0 or invalid
      setStatusMessage('Minimum delay cannot be greater than maximum delay.');
    } else {
      setStatusMessage('');
    }
    onMinDelayChange(numericValue);
  };

  const handleMaxDelayInput = (value: string) => {
    const numericValue = parseInt(value, 10);
    if (isNaN(numericValue)) {
      onMaxDelayChange(0); // Or some default / keep previous valid
      return;
    }
    if (numericValue < 0) {
      setStatusMessage('Delay values cannot be negative.');
      onMaxDelayChange(numericValue);
      return;
    }
    if (minDelay > numericValue && minDelay > 0) {
      setStatusMessage('Maximum delay cannot be less than minimum delay.');
    } else {
      setStatusMessage('');
    }
    onMaxDelayChange(numericValue);
  };

  const handleDateTimeChange = (newValue: Dayjs | null) => {
    if (newValue && newValue.isBefore(dayjs())) {
        setStatusMessage('Cannot schedule a job in the past.');
        // Optionally prevent setting it, or let App.tsx decide
    } else if (!newValue || !newValue.isValid()){
        setStatusMessage('Invalid schedule date/time.');
    } else {
        setStatusMessage('');
    }
    onScheduleDateTimeChange(newValue);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ marginTop: 4 }}>
        <Typography variant="h5" gutterBottom>
          Job Configuration
        </Typography>
        
        <Grid container spacing={3}>
          {/* Delay and API Settings */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Message Delays (ms)
            </Typography>
            <TextField
              label="Minimum Delay (ms)"
              type="number"
              value={minDelay}
              onChange={(e) => handleMinDelayInput(e.target.value)}
              fullWidth
              sx={{ marginBottom: 2 }}
              InputProps={{ inputProps: { min: 0 } }}
              error={minDelay < 0 || (minDelay > maxDelay && maxDelay > 0)}
              helperText={minDelay < 0 ? 'Delay cannot be negative.' : (minDelay > maxDelay && maxDelay > 0) ? 'Min delay > Max delay.' : ''}
            />
            <TextField
              label="Maximum Delay (ms)"
              type="number"
              value={maxDelay}
              onChange={(e) => handleMaxDelayInput(e.target.value)}
              fullWidth
              sx={{ marginBottom: 2 }}
              InputProps={{ inputProps: { min: 0 } }}
              error={maxDelay < 0 || (minDelay > maxDelay && minDelay > 0)}
              helperText={maxDelay < 0 ? 'Delay cannot be negative.' : (minDelay > maxDelay && minDelay > 0) ? 'Max delay < Min delay.' : ''}
            />

            <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
              API Configuration
            </Typography>
            <TextField
              label="API Key"
              type="text"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              fullWidth
              sx={{ marginBottom: 2 }}
            />
            <TextField
              label="Instance Name"
              type="text"
              value={instanceName}
              onChange={(e) => onInstanceNameChange(e.target.value)}
              fullWidth
              sx={{ marginBottom: 2 }}
            />
          </Grid>

          {/* Schedule Settings */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Schedule Start Time
            </Typography>
            <DateTimePicker
              label="Start Job At"
              value={scheduleDateTime}
              onChange={handleDateTimeChange} // Use the new handler
              sx={{ marginBottom: 2, display: 'block' }}
              minDateTime={dayjs()} // Prevent selecting past dates/times
            />
          </Grid>
        </Grid>
        {statusMessage && (
          <Typography variant="body1" color="error" sx={{ marginTop: 2 }}>
            {statusMessage}
          </Typography>
        )}
      </Box>
    </LocalizationProvider>
  );
};

export default SettingsComponent;
