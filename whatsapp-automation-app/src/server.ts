// /Users/gabrielgarcialeyva/CascadeProjects/whatsapp-automation-app/src/server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import { MessageSenderService, Message as CsvRowData } from './modules/message-sender'; // CsvRowData from message-sender
import { AppLogger } from './modules/logger'; // Corrected path
import { EvolutionApiConfig } from '../config/evolution-api.config'; // Corrected path

const logger = new AppLogger('Server'); // Instantiate logger

// Define a type for the expected CSV row structure from the frontend
interface SubmitJobPayload {
  csvData: CsvRowData[];
  minDelay: number;
  maxDelay: number;
  scheduleDateTime: string | null; // ISO string or null
  instanceName: string; // Added instanceName
  apiKey: string; // Added apiKey
}

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json({ limit: '50mb' })); // To parse JSON request bodies, increased limit for CSV data

// Initialize services (outside of request handlers if they are stateless or managed)
// For now, we'll instantiate MessageSenderService inside the route for simplicity,
// but in a larger app, you might manage its lifecycle differently.

app.get('/', (req: Request, res: Response) => {
  res.send('WhatsApp Automation Backend is running!');
});

// Ensure the handler is correctly typed for async Express routes
app.post('/api/submit-job', async (req: Request, res: Response): Promise<void> => {
  logger.log('Received /api/submit-job request'); // Use instantiated logger
  try {
    const {
      csvData,
      minDelay,
      maxDelay,
      scheduleDateTime,
      instanceName,
      apiKey,
    } = req.body as SubmitJobPayload;

    // Basic validation
    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      res.status(400).json({ message: 'CSV data is required and must be a non-empty array.' });
      return;
    }
    if (typeof minDelay !== 'number' || typeof maxDelay !== 'number' || minDelay < 0 || maxDelay < 0) {
      res.status(400).json({ message: 'Minimum and maximum delay must be non-negative numbers.' });
      return;
    }
    if (minDelay > maxDelay) {
      res.status(400).json({ message: 'Minimum delay cannot be greater than maximum delay.' });
      return;
    }
    if (!instanceName || typeof instanceName !== 'string') {
      res.status(400).json({ message: 'Instance name is required.' });
      return;
    }
    if (!apiKey || typeof apiKey !== 'string') {
      res.status(400).json({ message: 'API key is required.' });
      return;
    }
    
    // Log received data
    logger.log(`Job submission received:\n  Instance: ${instanceName}\n  Messages: ${csvData.length}\n  Delay: ${minDelay}-${maxDelay}ms\n  Schedule: ${scheduleDateTime || 'Immediate'}`);

    // TODO: Implement scheduling logic if scheduleDateTime is provided
    if (scheduleDateTime) {
      const scheduleTime = new Date(scheduleDateTime);
      const now = new Date();
      if (scheduleTime <= now) {
        logger.warn('Scheduled time is in the past. Processing immediately.');
      } else {
        const delayUntilScheduled = scheduleTime.getTime() - now.getTime();
        logger.log(`Job scheduled for ${scheduleDateTime}. Waiting for ${delayUntilScheduled / 1000} seconds.`);
        setTimeout(async () => {
          logger.log(`Executing scheduled job for instance: ${instanceName}`);
          const evolutionConfig: EvolutionApiConfig = { EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || 'http://localhost:8081', EVOLUTION_API_KEY: apiKey }; // Added fallback for URL
          const messageSender = new MessageSenderService(instanceName, evolutionConfig, { minDelay, maxDelay });
          await messageSender.processMessages(csvData);
        }, delayUntilScheduled);

        res.status(202).json({ message: `Job scheduled for ${scheduleDateTime}. Messages will be processed then.` });
        return;
      }
    }
    
    // If not scheduled or scheduled for the past, process immediately
    logger.log(`Processing job immediately for instance: ${instanceName}`);
    const evolutionConfig: EvolutionApiConfig = { EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || 'http://localhost:8081', EVOLUTION_API_KEY: apiKey }; // Added fallback for URL
    const messageSender = new MessageSenderService(instanceName, evolutionConfig, { minDelay, maxDelay });
    
    messageSender.processMessages(csvData)
      .then(() => {
        logger.log(`Asynchronous job processing completed for instance: ${instanceName}`);
      })
      .catch(error => {
        logger.error(`Error during asynchronous job processing for instance ${instanceName}:`, error);
      });

    res.status(202).json({ message: 'Job accepted and is being processed. Check server logs for status.' });

  } catch (error) {
    logger.error('Error processing /api/submit-job:', error);
    if (error instanceof Error) {
        res.status(500).json({ message: 'Internal server error', error: error.message });
    } else {
        res.status(500).json({ message: 'Internal server error' });
    }
  }
});

app.listen(PORT, () => {
  logger.log(`Backend server listening on http://localhost:${PORT}`);
});
