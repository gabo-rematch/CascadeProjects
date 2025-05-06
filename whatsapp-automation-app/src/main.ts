import 'reflect-metadata';
// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module'; // We'll create this next
import * as dotenv from 'dotenv';
import * as path from 'path';
import { CsvProvider, MessageData } from './modules/csv-provider';
import { MessageSenderService } from './modules/message-sender';
import { AppLogger } from './modules/logger';

const logger = new AppLogger('Bootstrap');

async function bootstrap() {
  // Load environment variables from config/.env
  // Adjust the path according to your final build structure if needed.
  // For ts-node, this path should be relative to the execution directory (project root usually)
  dotenv.config({ path: path.resolve(process.cwd(), 'config/.env') });

  logger.log('Starting WhatsApp Automation App...');
  logger.log(`CUSTOM_API_ENDPOINT: ${process.env.CUSTOM_API_ENDPOINT || 'Not Set'}`);
  logger.log(`MIN_DELAY_MS: ${process.env.MIN_DELAY_MS || 'Not Set'}`);
  logger.log(`MAX_DELAY_MS: ${process.env.MAX_DELAY_MS || 'Not Set'}`);
  logger.log(`CSV_FILE_PATH: ${process.env.CSV_FILE_PATH || 'Not Set'}`);

  const csvFilePath = process.env.CSV_FILE_PATH;
  if (!csvFilePath) {
    logger.error('CSV_FILE_PATH is not defined in environment variables. Exiting.');
    process.exit(1);
  }

  const absoluteCsvPath = path.resolve(process.cwd(), csvFilePath);

  try {
    logger.log('Initializing services...');
    const csvProvider = new CsvProvider(absoluteCsvPath);
    const messageSenderService = new MessageSenderService();

    logger.log('Loading messages from CSV...');
    const messages: MessageData[] = await csvProvider.getMessages();

    if (messages.length === 0) {
      logger.log('No messages found in CSV file. Exiting.');
      return;
    }

    logger.log(`Found ${messages.length} messages. Starting processing...`);
    await messageSenderService.processMessages(messages);

  } catch (error) {
    logger.error('An error occurred during the automation process:', (error as Error).message);
    if ((error as Error).stack) {
      logger.error('Stacktrace:', (error as Error).stack);
    }
    process.exit(1); // Exit with error code
  }

  logger.log('Bootstrap function finished successfully.');
}

bootstrap().catch(err => {
  // This catch is for errors *outside* the main try-catch in bootstrap, 
  // e.g., if dotenv.config or initial logger setup fails.
  console.error('Critical error during bootstrap setup:', err);
  process.exit(1);
});
