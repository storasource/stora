/**
 * @stora-sh/screenshots - Simulator Pool
 *
 * Manages a pool of iOS simulators for parallel screenshot capture.
 * Provides device lifecycle management, cleanup, and queue-based acquisition.
 */

import { SimulatorManager } from './index.js';
import type { PoolDevice, PoolConfig } from './types.js';

/**
 * Queue entry for jobs waiting for a simulator to become available
 */
interface WaitQueueEntry {
  resolve: (udid: string) => void;
  reject: (error: Error) => void;
  acquiredAt: number;
}

/**
 * Default pool configuration values
 */
const DEFAULT_CONFIG: PoolConfig = {
  maxSize: 5,
  preCreateCount: 2,
  acquireTimeout: 60000,
  deviceType: 'iPhone 15 Pro',
  cleanupStrategy: 'uninstall',
};

/**
 * SimulatorPool manages a pool of iOS simulators for parallel job execution.
 *
 * Features:
 * - Pre-creates simulators on initialization for fast acquisition
 * - Expands pool on demand up to maxSize
 * - Queue-based waiting when pool is exhausted
 * - Automatic cleanup after job completion (uninstall apps)
 * - Orphaned device cleanup
 *
 * @example
 * ```typescript
 * const pool = new SimulatorPool({ maxSize: 3 });
 * await pool.initialize();
 *
 * const udid = await pool.acquire('job-123');
 * // ... run screenshot capture ...
 * await pool.release(udid, 'com.example.app');
 *
 * await pool.shutdown();
 * ```
 */
export class SimulatorPool {
  /**
   * Map of device UDID to PoolDevice for tracking all pool devices
   */
  private devices: Map<string, PoolDevice> = new Map();

  /**
   * Queue of jobs waiting for an available simulator
   */
  private waitQueue: WaitQueueEntry[] = [];

  /**
   * Pool configuration with defaults applied
   */
  private config: PoolConfig;

  /**
   * Reference to SimulatorManager for device operations
   * Note: SimulatorManager uses static methods, kept as instance for future refactoring
   */
  private simulatorManager: typeof SimulatorManager;

  /**
   * Creates a new SimulatorPool instance.
   *
   * @param config - Partial configuration, merged with defaults
   */
  constructor(config: Partial<PoolConfig> = {}) {
    this.config = {
      maxSize: config.maxSize ?? DEFAULT_CONFIG.maxSize,
      preCreateCount: config.preCreateCount ?? DEFAULT_CONFIG.preCreateCount,
      acquireTimeout: config.acquireTimeout ?? DEFAULT_CONFIG.acquireTimeout,
      deviceType: config.deviceType ?? DEFAULT_CONFIG.deviceType,
      cleanupStrategy: config.cleanupStrategy ?? DEFAULT_CONFIG.cleanupStrategy,
    };
    this.simulatorManager = SimulatorManager;
  }

  /**
   * Initializes the pool by pre-creating the configured number of simulators.
   * Should be called before acquire() to ensure fast device availability.
   *
   * @returns Promise that resolves when all pre-created devices are ready
   */
  async initialize(): Promise<void> {
    // TODO: Implement in Task 2
    // Pre-create devices based on preCreateCount
    // for (let i = 0; i < this.config.preCreateCount; i++) {
    //   await this.createDevice();
    // }
    throw new Error('Not implemented: initialize()');
  }

  /**
   * Acquires an available simulator from the pool for a job.
   *
   * Behavior:
   * 1. Check for idle device - return immediately if available
   * 2. If none idle, create new device (if under maxSize)
   * 3. If at max capacity, add to wait queue with timeout
   * 4. Mark device as 'in-use' and set inUseBy to jobId
   *
   * @param jobId - Unique identifier for the job acquiring the device
   * @returns Promise resolving to the UDID of the acquired simulator
   * @throws Error if timeout expires while waiting for a device
   */
  async acquire(jobId: string): Promise<string> {
    // TODO: Implement in Task 2
    // 1. Check for idle device
    // 2. If none, create new (if under maxSize)
    // 3. If at max, add to waitQueue with timeout
    // 4. Mark device as 'in-use', set inUseBy
    // 5. Return udid
    throw new Error('Not implemented: acquire()');
  }

  /**
   * Releases a simulator back to the pool after job completion.
   *
   * Behavior:
   * 1. Find device in pool by UDID
   * 2. Clean device (uninstall app if bundleId provided)
   * 3. Mark as 'idle' and clear inUseBy
   * 4. Notify first waiter in queue if any are waiting
   *
   * @param udid - UDID of the device to release
   * @param bundleId - Optional bundle ID of app to uninstall for cleanup
   * @returns Promise that resolves when device is cleaned and released
   */
  async release(udid: string, bundleId?: string): Promise<void> {
    // TODO: Implement in Task 2
    // 1. Find device in pool
    // 2. Clean device (uninstall app if bundleId provided)
    // 3. Mark as 'idle'
    // 4. Notify first waiter in queue
    throw new Error('Not implemented: release()');
  }

  /**
   * Shuts down the pool and cleans up all managed simulators.
   *
   * Behavior:
   * 1. Wait for all in-use devices to be released (with timeout)
   * 2. Shutdown and delete all pool devices
   * 3. Clear wait queue, rejecting any pending waiters
   *
   * @returns Promise that resolves when all devices are shut down
   */
  async shutdown(): Promise<void> {
    // TODO: Implement in Task 2
    // 1. Wait for all in-use devices to be released
    // 2. Shutdown and delete all pool devices
    // 3. Clear waitQueue
    throw new Error('Not implemented: shutdown()');
  }

  /**
   * Creates a new simulator device and adds it to the pool.
   *
   * @returns Promise resolving to the created PoolDevice
   * @private
   */
  private async createDevice(): Promise<PoolDevice> {
    // TODO: Implement in Task 2
    // 1. Generate name: `${deviceType}-pool-${Date.now()}`
    // 2. Call simulatorManager.boot()
    // 3. Add to devices Map
    // 4. Return device
    throw new Error('Not implemented: createDevice()');
  }

  /**
   * Cleans a device for reuse by uninstalling apps or erasing.
   *
   * @param udid - UDID of the device to clean
   * @param bundleId - Optional bundle ID of app to uninstall
   * @private
   */
  private async cleanDevice(udid: string, bundleId?: string): Promise<void> {
    // TODO: Implement in Task 2
    // If bundleId: xcrun simctl uninstall <udid> <bundleId>
    // Else if strategy is 'erase': xcrun simctl erase <udid>
    throw new Error('Not implemented: cleanDevice()');
  }

  /**
   * Cleans up orphaned pool devices that are not tracked by this instance.
   * Useful for recovering from crashed processes that left devices running.
   *
   * Behavior:
   * 1. Get all devices via xcrun simctl list devices -j
   * 2. Find devices with "-pool-" in name not in this.devices
   * 3. Delete orphaned devices
   *
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanupOrphanedDevices(): Promise<void> {
    // TODO: Implement in Task 3
    // 1. Get all devices: xcrun simctl list devices -j
    // 2. Find devices with "pool-" prefix not in this.devices
    // 3. Delete orphaned devices
    throw new Error('Not implemented: cleanupOrphanedDevices()');
  }

  /**
   * Gets the current pool configuration.
   */
  getConfig(): Readonly<PoolConfig> {
    return { ...this.config };
  }

  /**
   * Gets the current pool statistics.
   */
  getStats(): {
    totalDevices: number;
    idleDevices: number;
    inUseDevices: number;
    waitQueueLength: number;
  } {
    let idle = 0;
    let inUse = 0;
    for (const device of this.devices.values()) {
      if (device.state === 'idle') idle++;
      if (device.state === 'in-use') inUse++;
    }
    return {
      totalDevices: this.devices.size,
      idleDevices: idle,
      inUseDevices: inUse,
      waitQueueLength: this.waitQueue.length,
    };
  }
}

export type { PoolDevice, PoolConfig };
