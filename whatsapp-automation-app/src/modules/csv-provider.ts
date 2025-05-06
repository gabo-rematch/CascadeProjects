import * as fs from 'fs';
import { parse } from 'csv-parse';
import { AppLogger } from './logger';

export interface MessageData {
  phoneNumber: string;
  messageBody: string;
  // Potentially add an ID or row number from CSV for tracking
  csvRowNumber?: number; 
}

export class CsvProvider {
  private readonly logger = new AppLogger(CsvProvider.name);

  constructor(private readonly filePath: string) {
    if (!this.filePath) {
      throw new Error('CSV file path is required.');
    }
  }

  public async getMessages(): Promise<MessageData[]> {
    this.logger.log(`Reading CSV file from: ${this.filePath}`);
    if (!fs.existsSync(this.filePath)) {
      this.logger.error(`CSV file not found at path: ${this.filePath}`);
      throw new Error(`CSV file not found: ${this.filePath}`);
    }

    const fileContent = fs.readFileSync(this.filePath, { encoding: 'utf-8' });

    return new Promise((resolve, reject) => {
      // Assuming CSV format: phoneNumber,messageBody
      // Adjust columns if your CSV is different (e.g., has headers)
      parse(fileContent, { columns: ['phoneNumber', 'messageBody'], from_line: 1, skip_empty_lines: true }, 
        (error, result: MessageData[]) => {
        if (error) {
          this.logger.error('Error parsing CSV:', error.message);
          return reject(error);
        }
        this.logger.log(`Successfully parsed ${result.length} messages from CSV.`);
        
        // Add row numbers for better tracking/logging if needed
        const messagesWithRowNumbers = result.map((msg, index) => ({ ...msg, csvRowNumber: index + 1 }));
        resolve(messagesWithRowNumbers);
      });
    });
  }
}
