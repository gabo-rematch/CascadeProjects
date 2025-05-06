import axios from 'axios';
import { AppLogger } from './logger';
import { DelayUtil } from './delay-utils';
import { EvolutionApiConfig } from '../../config/evolution-api.config';

export interface Message {
  phoneNumber: string;
  messageBody: string;
}

export class MessageSenderService {
  private readonly logger = new AppLogger(MessageSenderService.name);
  private readonly instanceName: string;
  private readonly apiKey: string;
  private readonly evolutionApiUrl: string;
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(
    instanceName: string,
    config: EvolutionApiConfig,
    delaySettings?: { minDelay?: number; maxDelay?: number }
  ) {
    this.instanceName = instanceName;
    this.apiKey = config.EVOLUTION_API_KEY;
    this.evolutionApiUrl = config.EVOLUTION_API_URL;
    this.minDelayMs = delaySettings?.minDelay ?? 2000; // Default 2s
    this.maxDelayMs = delaySettings?.maxDelay ?? 10000; // Default 10s

    if (this.minDelayMs < 0) this.minDelayMs = 0;
    if (this.maxDelayMs < 0) this.maxDelayMs = 0;

    if (this.minDelayMs > this.maxDelayMs) {
      this.logger.warn(`Min delay (${this.minDelayMs}ms) is greater than max delay (${this.maxDelayMs}ms). Using max delay as min delay.`);
      this.minDelayMs = this.maxDelayMs;
    }

    if (!this.evolutionApiUrl) {
      this.logger.error('EVOLUTION_API_URL is not set in the provided config.');
    }
    if (!this.instanceName) {
      this.logger.error('Instance name is not set.');
    }
    if (!this.apiKey) {
      this.logger.error('EVOLUTION_API_KEY is not set in the provided config.');
    }
    this.logger.log(`MessageSenderService initialized for instance: ${this.instanceName} with delays: ${this.minDelayMs}-${this.maxDelayMs}ms`);
  }

  private async sendMessage(phoneNumber: string, messageBody: string): Promise<boolean> {
    this.logger.log(`Attempting to send message to ${phoneNumber}. Original Raw Body: [${messageBody}]`); 
    
    const fullPhoneNumber = `${phoneNumber}@s.whatsapp.net`;
    this.logger.log(`Type of fullPhoneNumber before payload creation: ${typeof fullPhoneNumber}, value: ${fullPhoneNumber}`);
    
    const payload = {
      number: String(fullPhoneNumber), // Ensure phoneNumber is a string and includes @s.whatsapp.net
      text: messageBody, // Send messageBody as is (should contain \n for newlines)
    };
    this.logger.log(`Payload to be sent: ${JSON.stringify(payload)}`);

    const endpoint = `${this.evolutionApiUrl}/message/sendText/${this.instanceName}`;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': this.apiKey,
    };

    try {
      this.logger.debug(`Sending message to ${phoneNumber} via ${endpoint} with payload: ${JSON.stringify(payload)}`);
      const response = await axios.post(endpoint, payload, { headers });
      if (response.status >= 200 && response.status < 300) {
        this.logger.log(`Message sent successfully to ${phoneNumber}. Response: ${response.status}`);
        return true;
      } else {
        this.logger.warn(`API request to send message to ${phoneNumber} failed with status ${response.status}. Response: ${JSON.stringify(response.data)}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Error sending message to ${phoneNumber} via Evolution API:`, error);
      if (axios.isAxiosError(error) && error.response) {
        this.logger.error(`API Error Response Data: ${JSON.stringify(error.response.data)}`);
      }
      return false;
    }
  }

  async processMessages(messages: Message[]): Promise<{ successCount: number; failureCount: number }> {
    let successCount = 0;
    let failureCount = 0;

    this.logger.log(`Starting to process ${messages.length} messages for instance ${this.instanceName}.`);

    for (const [index, message] of messages.entries()) {
      this.logger.log(`Processing message ${index + 1}/${messages.length}: To ${message.phoneNumber}`);
      try {
        const success = await this.sendMessage(message.phoneNumber, message.messageBody);
        if (success) {
          this.logger.log(`Successfully sent message to ${message.phoneNumber}`);
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        // Error already logged in sendMessage
        failureCount++;
        // Optionally, add to a list of failed messages for retry or reporting
      }
      if (index < messages.length - 1) {
        const delay = DelayUtil.getRandomDelayInRange(this.minDelayMs, this.maxDelayMs);
        this.logger.log(`Waiting for ${delay / 1000} seconds before next message...`);
        await DelayUtil.wait(delay);
      }
    }
    this.logger.log(`Finished processing all messages for instance ${this.instanceName}.`);
    this.logger.log(`Summary for instance ${this.instanceName}: Successes = ${successCount}, Failures = ${failureCount}`);
    return { successCount, failureCount };
  }
}
