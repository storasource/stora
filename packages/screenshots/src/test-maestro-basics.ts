#!/usr/bin/env ts-node
/**
 * Ultra-Simple Test - Just to verify Maestro commands work
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';

const BUNDLE_ID = process.argv[2] || 'com.nmmsoft.doddle.stora';

function runMaestroFlow(yamlContent: string): string {
  const flowPath = `/tmp/test-flow-${Date.now()}.yaml`;
  writeFileSync(flowPath, yamlContent);

  try {
    const output = execSync(`maestro test ${flowPath}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return output;
  } catch (error: any) {
    console.error('Flow failed:', error.message);
    throw error;
  }
}

async function test() {
  console.log('1. Testing launchApp...');
  const launchFlow = `appId: ${BUNDLE_ID}
---
- launchApp`;

  try {
    runMaestroFlow(launchFlow);
    console.log('✓ Launch worked');
  } catch (e) {
    console.log('✗ Launch failed');
    return;
  }

  // Wait a bit
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('\n2. Testing hierarchy...');
  try {
    const hierarchyOutput = execSync('maestro hierarchy', { encoding: 'utf-8' });
    const jsonMatch = hierarchyOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const hierarchy = JSON.parse(jsonMatch[0]);
      console.log('✓ Hierarchy worked');
      console.log('Sample:', JSON.stringify(hierarchy, null, 2).slice(0, 500));
    }
  } catch (e: any) {
    console.log('✗ Hierarchy failed:', e.message);
  }

  console.log('\n3. Testing screenshot...');
  try {
    const screenshotPath = '/tmp/test-screenshot.png';
    execSync(`maestro screenshot ${screenshotPath}`, { encoding: 'utf-8' });
    const exists = require('fs').existsSync(screenshotPath);
    console.log('✓ Screenshot worked:', exists);

    if (exists) {
      const buffer = readFileSync(screenshotPath);
      console.log('  Size:', buffer.length, 'bytes');
    }
  } catch (e: any) {
    console.log('✗ Screenshot failed:', e.message);
  }

  console.log('\n4. Testing tap...');
  const tapFlow = `appId: ${BUNDLE_ID}
---
- tapOn:
    point: 50%,50%`;

  try {
    runMaestroFlow(tapFlow);
    console.log('✓ Tap worked');
  } catch (e) {
    console.log('✗ Tap failed');
  }

  console.log('\nAll basic Maestro commands tested!');
}

test().catch(console.error);
