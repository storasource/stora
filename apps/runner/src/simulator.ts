import { execa } from 'execa';
import chalk from 'chalk';

interface SimDevice { state: string; isAvailable: boolean; name: string; udid: string; }
interface SimRuntime { version: string; isAvailable: boolean; name: string; identifier: string; }
interface SimDeviceType { name: string; identifier: string; }

export class SimulatorManager {
  async boot(deviceName: string = 'iPhone 15 Pro'): Promise<string> {
    console.log(chalk.blue(`[Simulator] Ensuring ${deviceName} is booted...`));
    
    const booted = await this.getBootedDevices();
    const existingBooted = booted.find(d => d.name === deviceName);
    if (existingBooted) {
      console.log(chalk.green(`[Simulator] ${deviceName} already booted: ${existingBooted.udid}`));
      return existingBooted.udid;
    }

    const allDevices = await this.getAllDevices();
    const existing = allDevices.find(d => d.name === deviceName);
    if (existing) {
      console.log(chalk.yellow(`[Simulator] ${deviceName} exists but not booted. Booting...`));
      return this.bootUDID(existing.udid, deviceName);
    }

    console.log(chalk.yellow(`[Simulator] Device ${deviceName} not found. Creating it...`));
    const udid = await this.createDevice(deviceName);
    return this.bootUDID(udid, deviceName);
  }

  private async bootUDID(udid: string, name: string): Promise<string> {
    console.log(chalk.blue(`[Simulator] Booting ${name} (${udid})...`));
    try { 
      await execa('xcrun', ['simctl', 'boot', udid]); 
    } catch (e: any) { 
      if (!e.message.includes('Unable to boot device in current state: Booted')) {
        throw e;
      }
    }
    try { 
      await execa('xcrun', ['simctl', 'bootstatus', udid, '-b']); 
    } catch (e) {
      console.log(chalk.yellow(`[Simulator] bootstatus returned error, but continuing...`));
    }
    console.log(chalk.green(`[Simulator] ${name} is now booted`));
    return udid;
  }

  private async createDevice(deviceName: string): Promise<string> {
    const deviceTypes = await this.getDeviceTypes();
    const deviceType = deviceTypes.find(dt => dt.name === deviceName);
    if (!deviceType) {
      const available = deviceTypes.map(dt => dt.name).slice(0, 10).join(', ');
      throw new Error(`Device type "${deviceName}" not found. Available: ${available}...`);
    }

    const runtimes = await this.getRuntimes();
    const iosRuntimes = runtimes
      .filter(r => r.name.startsWith('iOS') && r.isAvailable)
      .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
    
    if (iosRuntimes.length === 0) {
      throw new Error(`No available iOS runtimes found. Install one via Xcode.`);
    }

    const runtime = iosRuntimes[0];
    console.log(chalk.blue(`[Simulator] Creating ${deviceName} with ${runtime.name}...`));
    
    const { stdout } = await execa('xcrun', ['simctl', 'create', deviceName, deviceType.identifier, runtime.identifier]);
    const udid = stdout.trim();
    console.log(chalk.green(`[Simulator] Created ${deviceName}: ${udid}`));
    return udid;
  }

  private async getAllDevices(): Promise<SimDevice[]> {
    const { stdout } = await execa('xcrun', ['simctl', 'list', 'devices', '-j']);
    return Object.values(JSON.parse(stdout).devices).flat() as SimDevice[];
  }
  
  private async getBootedDevices(): Promise<SimDevice[]> {
    return (await this.getAllDevices()).filter(d => d.state === 'Booted');
  }

  private async getDeviceTypes(): Promise<SimDeviceType[]> {
    const { stdout } = await execa('xcrun', ['simctl', 'list', 'devicetypes', '-j']);
    return JSON.parse(stdout).devicetypes;
  }

  private async getRuntimes(): Promise<SimRuntime[]> {
    const { stdout } = await execa('xcrun', ['simctl', 'list', 'runtimes', '-j']);
    return JSON.parse(stdout).runtimes;
  }

  async install(udid: string, appPath: string): Promise<void> {
    console.log(chalk.blue(`[Simulator] Installing ${appPath}...`));
    await execa('xcrun', ['simctl', 'install', udid, appPath]);
    console.log(chalk.green(`[Simulator] Installed successfully`));
  }

  async launch(udid: string, bundleId: string): Promise<void> {
     await execa('xcrun', ['simctl', 'launch', udid, bundleId]);
  }
  
  async shutdown(udid: string): Promise<void> {
      await execa('xcrun', ['simctl', 'shutdown', udid]);
  }
}
