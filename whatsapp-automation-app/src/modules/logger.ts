export class AppLogger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private getTimestamp(): string {
    return new Date().toISOString();
  }

  private formatMessage(level: string, message: string, ...optionalParams: any[]): string {
    const contextPrefix = this.context ? `[${this.context}] ` : '';
    const paramsString = optionalParams.length > 0 ? ` ${optionalParams.map(p => JSON.stringify(p)).join(' ')}` : '';
    return `${this.getTimestamp()} [${level.toUpperCase()}] ${contextPrefix}${message}${paramsString}`;
  }

  log(message: string, ...optionalParams: any[]) {
    console.log(this.formatMessage('log', message, ...optionalParams));
  }

  error(message: string, ...optionalParams: any[]) {
    console.error(this.formatMessage('error', message, ...optionalParams));
  }

  warn(message: string, ...optionalParams: any[]) {
    console.warn(this.formatMessage('warn', message, ...optionalParams));
  }

  debug(message: string, ...optionalParams: any[]) {
    // You might want to make debug logging conditional based on an env variable
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(this.formatMessage('debug', message, ...optionalParams));
    }
  }

  verbose(message: string, ...optionalParams: any[]) {
    // Similar to debug, conditional on LOG_LEVEL
    if (process.env.LOG_LEVEL === 'verbose' || process.env.LOG_LEVEL === 'debug') {
      console.info(this.formatMessage('verbose', message, ...optionalParams)); // console.info for verbose
    }
  }
}
