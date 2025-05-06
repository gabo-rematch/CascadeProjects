// /Users/gabrielgarcialeyva/CascadeProjects/whatsapp-automation-app/src/server.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import { MessageSenderService, Message, JobReport } from './modules/message-sender'; // Updated import
import { AppLogger } from './modules/logger'; // Corrected path
import { EvolutionApiConfig } from '../config/evolution-api.config'; // Corrected path

const logger = new AppLogger('Server'); // Instantiate logger

// Define a type for the expected CSV row structure from the frontend
interface SubmitJobPayload {
  csvData: Message[];
  minDelay: number;
  maxDelay: number;
  scheduleDateTime: string | null; // ISO string or null
  instanceName: string; // Added instanceName
  apiKey: string; // Added apiKey
  runNow: boolean; // Added runNow flag
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
      runNow, // Destructure runNow
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
    logger.log(`Job submission received:\n  Instance: ${instanceName}\n  Messages: ${csvData.length}\n  Delay: ${minDelay}-${maxDelay}ms\n  Schedule: ${scheduleDateTime || 'Not specified'}\n  Run Now: ${runNow}`);

    const executeJob = async (): Promise<JobReport | undefined> => {
      logger.log(`Processing job for instance: ${instanceName}`);
      const evolutionConfig: EvolutionApiConfig = { EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || 'http://localhost:8081', EVOLUTION_API_KEY: apiKey };
      const messageSender = new MessageSenderService(instanceName, evolutionConfig, { minDelay, maxDelay });
      try {
        const report = await messageSender.processMessages(csvData);
        logger.log(`Job processing completed for instance: ${instanceName}. Success: ${report.summary.successCount}, Failures: ${report.summary.failureCount}`);
        return report;
      } catch (jobError) {
        logger.error(`Error during job processing for instance ${instanceName}:`, jobError);
        return undefined; // Indicate failure to process
      }
    };

    if (runNow) {
      logger.log('"Run Now" flag is true. Processing job immediately.');
      const report = await executeJob(); 
      if (report) {
        res.status(200).json({ message: 'Job processed immediately.', report });
      } else {
        res.status(500).json({ message: 'Job processing failed immediately. Check server logs.'});
      }
      return;
    }

    // If not runNow, proceed with scheduling logic or immediate execution if schedule is invalid/past
    if (scheduleDateTime) {
      const scheduleTime = new Date(scheduleDateTime);
      const now = new Date();

      if (scheduleTime > now) {
        const delayUntilScheduled = scheduleTime.getTime() - now.getTime();
        logger.log(`Job scheduled for ${scheduleDateTime}. Waiting for ${delayUntilScheduled / 1000} seconds.`);
        setTimeout(async () => { // Make the setTimeout callback async to log report details
            logger.log(`Executing scheduled job for instance: ${instanceName} at ${new Date().toISOString()}`);
            const report = await executeJob();
            if (report) {
                logger.log(`Scheduled job for ${instanceName} completed. Success: ${report.summary.successCount}, Failures: ${report.summary.failureCount}`);
            } else {
                logger.error(`Scheduled job for ${instanceName} failed to produce a report.`);
            }
        }, delayUntilScheduled);
        res.status(202).json({ message: `Job scheduled for ${scheduleDateTime}. Messages will be processed then.` });
        return;
      } else {
        logger.warn('Scheduled time is in the past or invalid. Processing immediately.');
      }
    } else {
      logger.log('No scheduleDateTime provided and runNow is false. Processing job immediately.');
    }
    
    // Fallback: Process immediately if not runNow and not scheduled for future
    const report = await executeJob(); 
    if (report) {
        res.status(200).json({ message: 'Job processed (no valid future schedule or runNow was false).', report });
    } else {
        res.status(500).json({ message: 'Job processing failed (no valid future schedule or runNow was false). Check server logs.'});
    }

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
