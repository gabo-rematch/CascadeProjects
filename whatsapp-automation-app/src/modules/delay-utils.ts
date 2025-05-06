export class DelayUtil {
  /**
   * Generates a random delay time within a specified range.
   * @param minMs Minimum delay in milliseconds.
   * @param maxMs Maximum delay in milliseconds.
   * @returns A random number of milliseconds between minMs and maxMs (inclusive).
   */
  public static getRandomDelayInRange(minMs: number, maxMs: number): number {
    if (minMs < 0 || maxMs < 0) {
      throw new Error('Delay values must be non-negative.');
    }
    if (minMs > maxMs) {
      throw new Error('Minimum delay cannot be greater than maximum delay.');
    }
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  }

  /**
   * Pauses execution for a specified number of milliseconds.
   * @param ms The number of milliseconds to wait.
   * @returns A Promise that resolves after the delay.
   */
  public static async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * A convenience function to introduce a random delay using a min/max range.
   * @param minMs Minimum delay in milliseconds.
   * @param maxMs Maximum delay in milliseconds.
   */
  public static async randomDelay(minMs: number, maxMs: number): Promise<void> {
    const delayTime = this.getRandomDelayInRange(minMs, maxMs);
    await this.wait(delayTime);
  }
}
