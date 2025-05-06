import axios from 'axios';
import { AppLogger } from './logger';
import { DelayUtil } from './delay-utils';
import { EvolutionApiConfig } from '../../config/evolution-api.config';

export interface Message {
  phoneNumber: string;
  messageBody: string;
}

export interface MessageReportItem {
  phoneNumber: string;
  messageBodySnippet: string; // Store a snippet to avoid large payloads
  status: 'Sent' | 'Failed';
  error?: string; // Optional error details if failed
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

  private async sendMessage(phoneNumber: string, messageBody: string): Promise<{ success: boolean; errorDetail?: string }> {
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
        return { success: true };
      } else {
        const errorDetail = `API Error: Status ${response.status} - ${JSON.stringify(response.data)}`;
        this.logger.warn(`API request to send message to ${phoneNumber} failed. ${errorDetail}`);
        return { success: false, errorDetail };
      }
    } catch (error) {
      let errorDetail = 'Unknown error during send.';
      if (axios.isAxiosError(error)) {
        errorDetail = error.message;
        if (error.response) {
          errorDetail += ` - Data: ${JSON.stringify(error.response.data)}`;
          this.logger.error(`API Error Response Data: ${JSON.stringify(error.response.data)}`);
        }
      }
      this.logger.error(`Error sending message to ${phoneNumber} via Evolution API: ${errorDetail}`, error);
      return { success: false, errorDetail };
    }
  }

  async processMessages(messages: Message[]): Promise<JobReport> {
    let successCount = 0;
    let failureCount = 0;
    const reportDetails: MessageReportItem[] = [];

    this.logger.log(`Starting to process ${messages.length} messages for instance ${this.instanceName}.`);

    for (const [index, message] of messages.entries()) {
      this.logger.log(`Processing message ${index + 1}/${messages.length}: To ${message.phoneNumber}`);
      const messageBodySnippet = message.messageBody.length > 50 ? `${message.messageBody.substring(0, 47)}...` : message.messageBody;
      let reportItem: MessageReportItem;
      try {
        const result = await this.sendMessage(message.phoneNumber, message.messageBody);
        if (result.success) {
          this.logger.log(`Successfully sent message to ${message.phoneNumber}`);
          successCount++;
          reportItem = {
            phoneNumber: message.phoneNumber,
            messageBodySnippet,
            status: 'Sent',
            timestamp: new Date().toISOString(),
          };
        } else {
          failureCount++;
          reportItem = {
            phoneNumber: message.phoneNumber,
            messageBodySnippet,
            status: 'Failed',
            error: result.errorDetail || 'Failed to send',
            timestamp: new Date().toISOString(),
          };
        }
      } catch (error) {
        // This catch block might be redundant if sendMessage handles all its errors and returns a result object.
        // However, for unexpected errors in the loop itself:
        this.logger.error(`Unexpected error processing message for ${message.phoneNumber}:`, error);
        failureCount++;
        reportItem = {
          phoneNumber: message.phoneNumber,
          messageBodySnippet,
          status: 'Failed',
          error: error instanceof Error ? error.message : 'Unknown processing error',
          timestamp: new Date().toISOString(),
        };
      }
      reportDetails.push(reportItem);

      if (index < messages.length - 1) {
        const delay = DelayUtil.getRandomDelayInRange(this.minDelayMs, this.maxDelayMs);
        this.logger.log(`Waiting for ${delay / 1000} seconds before next message...`);
        await DelayUtil.wait(delay);
      }
    }
    this.logger.log(`Finished processing all messages for instance ${this.instanceName}.`);
    this.logger.log(`Summary for instance ${this.instanceName}: Successes = ${successCount}, Failures = ${failureCount}`);
    
    return {
      summary: {
        successCount,
        failureCount,
        totalMessages: messages.length,
      },
      details: reportDetails,
    };
  }
}
