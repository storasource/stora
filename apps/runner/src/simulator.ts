import { execa } from 'execa';
import chalk from 'chalk';

export class SimulatorManager {
  /**
   * Boots a simulator with the given device type and runtime.
   * If a simulator is already booted, it returns its UDID.
   */
  async boot(deviceType: string = 'iPhone 17 Pro', runtime: string = 'iOS 17.2'): Promise<string> {
    console.log(chalk.blue(`[Simulator] checking for ${deviceType}...`));
    
    // Check if already booted
    const { stdout: listOut } = await execa('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']);
    const booted = JSON.parse(listOut).devices;
    
    // Flatten device list (structure is { "runtime": [devices] })
    const allBooted = Object.values(booted).flat() as any[];
    const existing = allBooted.find(d => d.name === deviceType);
    
    if (existing) {
      console.log(chalk.green(`[Simulator] ${deviceType} (${existing.udid}) is already booted.`));
      return existing.udid;
    }

    // Find available device to boot
    console.log(chalk.yellow(`[Simulator] Booting ${deviceType}...`));
    // Note: In a real robust system, we'd lookup the UDID from 'xcrun simctl list' first.
    // For now, we assume 'iPhone 17 Pro' is a valid alias if the runtime matches.
    
    try {
      const { stdout: udid } = await execa('xcrun', ['simctl', 'bootstatus', deviceType, '-b']);
      console.log(chalk.green(`[Simulator] Booted ${udid}`));
      return udid.trim();
    } catch (e: any) {
        // Fallback: try simple boot if bootstatus fails or returns empty
        const { stdout: bootOut } = await execa('xcrun', ['simctl', 'boot', deviceType]);
        // Get the UDID now
        const { stdout: listAfter } = await execa('xcrun', ['simctl', 'list', 'devices', 'booted', '-j']);
        const bootedAfter = Object.values(JSON.parse(listAfter).devices).flat() as any[];
        const found = bootedAfter.find(d => d.name === deviceType);
        if (!found) throw new Error(`Failed to boot ${deviceType}`);
        return found.udid;
    }
  }

  /**
   * Installs the .app bundle onto the simulator.
   */
  async install(udid: string, appPath: string): Promise<void> {
    console.log(chalk.blue(`[Simulator] Installing ${appPath} to ${udid}...`));
    await execa('xcrun', ['simctl', 'install', udid, appPath]);
    console.log(chalk.green(`[Simulator] Install complete.`));
  }

  /**
   * Launches the app (optional, Maestro does this automatically usually).
   */
  async launch(udid: string, bundleId: string): Promise<void> {
     await execa('xcrun', ['simctl', 'launch', udid, bundleId]);
  }
  
  async shutdown(udid: string): Promise<void> {
      await execa('xcrun', ['simctl', 'shutdown', udid]);
  }
}
