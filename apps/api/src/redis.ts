import { Redis } from 'ioredis';
import chalk from 'chalk';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl);

// Connection event handlers
redis.on('connect', () => {
  console.log(chalk.green(`[Redis] Connected to ${redisUrl}`));
});

redis.on('ready', () => {
  console.log(chalk.green('[Redis] Ready to accept commands'));
});

redis.on('error', (err: Error) => {
  console.error(chalk.red(`[Redis] Connection error: ${err.message}`));
});

redis.on('close', () => {
  console.log(chalk.yellow('[Redis] Connection closed'));
});

redis.on('reconnecting', () => {
  console.log(chalk.yellow('[Redis] Attempting to reconnect...'));
});

export default redis;
