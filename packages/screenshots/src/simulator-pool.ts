/**
 * @stora-sh/screenshots - Simulator Pool
 *
 * Manages a pool of iOS simulators for parallel screenshot capture.
 * Provides device lifecycle management, cleanup, and queue-based acquisition.
 */

import { execa } from 'execa';
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
  }

  /**
   * Initializes the pool by pre-creating the configured number of simulators.
   * Should be called before acquire() to ensure fast device availability.
   *
   * @returns Promise that resolves when all pre-created devices are ready
   */
  async initialize(): Promise<void> {
    await this.cleanupOrphanedDevices();
    
    for (let i = 0; i < this.config.preCreateCount; i++) {
      await this.createDevice();
    }
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
    // 1. Find idle device
    const idleDevice = Array.from(this.devices.values()).find(d => d.state === 'idle');
    
    if (idleDevice) {
      // Health check: verify device is bootable before returning
      try {
        await execa('xcrun', ['simctl', 'bootstatus', idleDevice.udid, '-b'], { timeout: 10000 });
      } catch {
        // Device failed health check - mark corrupted and recreate
        console.error(`Device ${idleDevice.udid} failed health check, recreating...`);
        idleDevice.state = 'corrupted';
        await this.deleteDevice(idleDevice.udid);
        return this.acquire(jobId);
      }
      
      idleDevice.state = 'in-use';
      idleDevice.inUseBy = jobId;
      idleDevice.lastUsedAt = new Date();
      return idleDevice.udid;
    }

    // 2. Create new if under limit
    if (this.devices.size < this.config.maxSize) {
      const device = await this.createDevice();
      device.state = 'in-use';
      device.inUseBy = jobId;
      return device.udid;
    }

    // 3. Queue and wait
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitQueue.findIndex(w => w.resolve === resolve);
        if (index !== -1) this.waitQueue.splice(index, 1);
        reject(new Error('Timeout acquiring device from pool'));
      }, this.config.acquireTimeout);

      this.waitQueue.push({
        resolve: (udid: string) => {
          clearTimeout(timeout);
          resolve(udid);
        },
        reject,
        acquiredAt: Date.now()
      });
    });
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
    const device = this.devices.get(udid);
    if (!device) throw new Error(`Device ${udid} not in pool`);

    device.state = 'cleaning';
    
    try {
      await this.cleanDevice(udid, bundleId);
      device.state = 'idle';
      device.inUseBy = undefined;

      const waiter = this.waitQueue.shift();
      if (waiter) {
        device.state = 'in-use';
        device.inUseBy = 'queued-job';
        waiter.resolve(udid);
      }
    } catch (error) {
      device.state = 'corrupted';
      console.error(`Device ${udid} corrupted, recreating...`);
      await this.deleteDevice(udid);
      await this.createDevice();
    }
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
    const deviceName = `${this.config.deviceType.replace(/\s+/g, '-')}-pool-${Date.now()}`;
    
    const { stdout: deviceTypesJson } = await execa('xcrun', ['simctl', 'list', 'devicetypes', '-j']);
    const deviceTypes = JSON.parse(deviceTypesJson).devicetypes as Array<{ name: string; identifier: string }>;
    const deviceType = deviceTypes.find(dt => dt.name === this.config.deviceType);
    if (!deviceType) {
      throw new Error(`Device type "${this.config.deviceType}" not found`);
    }

    const { stdout: runtimesJson } = await execa('xcrun', ['simctl', 'list', 'runtimes', '-j']);
    const runtimes = JSON.parse(runtimesJson).runtimes as Array<{ name: string; identifier: string; isAvailable: boolean; version: string }>;
    const iosRuntimes = runtimes
      .filter(r => r.name.startsWith('iOS') && r.isAvailable)
      .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
    
    if (iosRuntimes.length === 0) {
      throw new Error('No available iOS runtimes found');
    }

    const runtime = iosRuntimes[0];
    const { stdout: createOut } = await execa('xcrun', ['simctl', 'create', deviceName, deviceType.identifier, runtime.identifier]);
    const udid = createOut.trim();

    try {
      await execa('xcrun', ['simctl', 'boot', udid]);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (!err.message?.includes('Unable to boot device in current state: Booted')) {
        throw e;
      }
    }

    try {
      await execa('xcrun', ['simctl', 'bootstatus', udid, '-b']);
    } catch {
      console.log('bootstatus returned error, but continuing...');
    }

    const device: PoolDevice = {
      udid,
      name: deviceName,
      deviceType: this.config.deviceType,
      state: 'idle',
      createdAt: new Date(),
    };

    this.devices.set(udid, device);
    return device;
  }

  /**
   * Cleans a device for reuse by uninstalling apps or erasing.
   *
   * @param udid - UDID of the device to clean
   * @param bundleId - Optional bundle ID of app to uninstall
   * @private
   */
  private async cleanDevice(udid: string, bundleId?: string): Promise<void> {
    if (bundleId) {
      await execa('xcrun', ['simctl', 'uninstall', udid, bundleId]);
    } else if (this.config.cleanupStrategy === 'erase') {
      await execa('xcrun', ['simctl', 'shutdown', udid]);
      await execa('xcrun', ['simctl', 'erase', udid]);
      await execa('xcrun', ['simctl', 'boot', udid]);
    }
  }

  /**
   * Deletes a simulator device and removes it from the pool.
   *
   * @param udid - UDID of the device to delete
   * @private
   */
  private async deleteDevice(udid: string): Promise<void> {
    try {
      await execa('xcrun', ['simctl', 'shutdown', udid]);
    } catch {
      // Ignore shutdown errors (device may already be shutdown)
    }
    await execa('xcrun', ['simctl', 'delete', udid]);
    this.devices.delete(udid);
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
    const { stdout } = await execa('xcrun', ['simctl', 'list', 'devices', '-j']);
    const allDevices = Object.values(JSON.parse(stdout).devices).flat() as Array<{ name: string; udid: string; state: string }>;
    
    const orphanedDevices = allDevices.filter(d => 
      d.name.includes('pool-') && !this.devices.has(d.udid)
    );

    for (const device of orphanedDevices) {
      console.log(`Cleaning up orphaned device: ${device.name}`);
      await execa('xcrun', ['simctl', 'shutdown', device.udid]).catch(() => {});
      await execa('xcrun', ['simctl', 'delete', device.udid]);
    }
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
