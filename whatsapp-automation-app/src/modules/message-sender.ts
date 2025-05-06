import axios from 'axios';
import { AppLogger } from './logger';
import { MessageData } from './csv-provider';
import { DelayUtil } from './delay-utils';

export class MessageSenderService {
  private readonly logger = new AppLogger(MessageSenderService.name);
  private readonly evolutionApiUrl: string;
  private readonly evolutionApiInstanceName: string;
  private readonly evolutionApiKey: string;
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;

  constructor() {
    this.evolutionApiUrl = process.env.EVOLUTION_API_URL || '';
    this.evolutionApiInstanceName = process.env.EVOLUTION_API_INSTANCE_NAME || '';
    this.evolutionApiKey = process.env.EVOLUTION_API_KEY || '';
    this.minDelayMs = parseInt(process.env.MIN_DELAY_MS || '2000', 10);
    this.maxDelayMs = parseInt(process.env.MAX_DELAY_MS || '10000', 10);

    if (!this.evolutionApiUrl) {
      this.logger.error('EVOLUTION_API_URL is not set in environment variables.');
      throw new Error('EVOLUTION_API_URL is required.');
    }
    if (!this.evolutionApiInstanceName) {
      this.logger.error('EVOLUTION_API_INSTANCE_NAME is not set in environment variables.');
      throw new Error('EVOLUTION_API_INSTANCE_NAME is required.');
    }
    if (!this.evolutionApiKey) {
      this.logger.error('EVOLUTION_API_KEY is not set in environment variables.');
      throw new Error('EVOLUTION_API_KEY is required.');
    }

    this.logger.log(`MessageSenderService initialized for Evolution API.`);
    this.logger.log(`Evolution API URL: ${this.evolutionApiUrl}`);
    this.logger.log(`Evolution API Instance: ${this.evolutionApiInstanceName}`);
    this.logger.log(`Delay range: ${this.minDelayMs}ms - ${this.maxDelayMs}ms`);
  }

  public async sendMessage(data: MessageData): Promise<boolean> {
    this.logger.log(`Attempting to send message to ${data.phoneNumber} via Evolution API (CSV Row: ${data.csvRowNumber || 'N/A'}).`);

    const endpoint = `${this.evolutionApiUrl}/message/sendText/${this.evolutionApiInstanceName}`;

    // Normalize phone number
    let normalizedNumber = data.phoneNumber;
    if (normalizedNumber.startsWith('+')) {
      normalizedNumber = normalizedNumber.substring(1);
    }
    if (!normalizedNumber.includes('@')) { // Check if JID suffix is missing
      normalizedNumber = `${normalizedNumber}@s.whatsapp.net`;
    }

    const payload = {
      number: normalizedNumber, 
      text: data.messageBody,
    };
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.evolutionApiKey,
    };

    try {
      const randomDelayValue = DelayUtil.getRandomDelayInRange(this.minDelayMs, this.maxDelayMs);
      this.logger.log(`Waiting for ${randomDelayValue}ms before sending...`);
      await DelayUtil.wait(randomDelayValue);

      this.logger.log(`Sending message to ${normalizedNumber} with text: "${data.messageBody}"`); 
      this.logger.debug(`POST to ${endpoint} with payload: ${JSON.stringify(payload)} and headers: ${JSON.stringify(headers)}`);

      const response = await axios.post(endpoint, payload, { headers });

      this.logger.log(`Message sent successfully to ${normalizedNumber}. API Response status: ${response.status}`);
      this.logger.debug(`API Response data: ${JSON.stringify(response.data)}`);

      // Simulate success for now if needed, or handle actual API response
      // For example, check response.data for success indicators from Evolution API
      if (response.status >= 200 && response.status < 300) {
        // Consider the message successfully sent based on HTTP status
        this.logger.log(`Message to ${normalizedNumber} considered successful by HTTP status.`);
        return true; // Indicate success
      } else {
        this.logger.warn(`Message to ${normalizedNumber} returned HTTP status ${response.status}. Response: ${JSON.stringify(response.data)}`);
        return false; // Indicate failure
      }

    } catch (error) {
      this.logger.error(`Failed to send message to ${data.phoneNumber}. Error: ${error}`);
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`Axios error details: Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)}`);
      }
      return false; // Indicate failure
    }
  }

  public async processMessages(messages: MessageData[]): Promise<void> {
    this.logger.log(`Starting to process ${messages.length} messages.`);
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      this.logger.log(`Processing message ${i + 1} of ${messages.length} to ${message.phoneNumber} (CSV Row: ${message.csvRowNumber || 'N/A'}).`);
      try {
        const sentSuccessfully = await this.sendMessage(message);
        if (sentSuccessfully) {
          successCount++;
        } else {
          failureCount++;
        }
        
        if (i < messages.length - 1) { // Don't delay after the last message
          const delay = DelayUtil.getRandomDelayInRange(this.minDelayMs, this.maxDelayMs);
          this.logger.log(`Waiting for ${delay}ms before next message...`);
          await DelayUtil.wait(delay);
        }
      } catch (error) {
        // Error already logged in sendMessage
        failureCount++;
        // Optionally, add to a list of failed messages for retry or reporting
      }
    }
    this.logger.log('--------------------------------------------------');
    this.logger.log('Message Processing Summary:');
    this.logger.log(`Total messages: ${messages.length}`);
    this.logger.log(`Successfully sent: ${successCount}`);
    this.logger.log(`Failed to send: ${failureCount}`);
    this.logger.log('--------------------------------------------------');
  }
}
