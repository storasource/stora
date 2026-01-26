import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { put } from '@vercel/blob';
import dotenv from 'dotenv';

dotenv.config();

export class ArtifactUploader {
  async upload(filePath: string): Promise<string> {
    console.log(chalk.blue(`[Upload] Processing artifact: ${filePath}...`));
    
    if (!await fs.pathExists(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const fileName = path.basename(filePath);
    
    // PRODUCTION MODE: If BLOB_READ_WRITE_TOKEN is present, use Vercel Blob
    if (process.env.BLOB_READ_WRITE_TOKEN) {
        console.log(chalk.blue(`[Upload] Uploading to Vercel Blob...`));
        try {
            const fileBuffer = await fs.readFile(filePath);
            const blob = await put(fileName, fileBuffer, { 
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN 
            });
            console.log(chalk.green(`[Upload] Uploaded to Blob: ${blob.url}`));
            return blob.url;
        } catch (e) {
            console.error(chalk.red(`[Upload] Blob upload failed: ${e}`));
            // Fallback to local copy if blob fails
        }
    }

    // DEV MODE: Copy to next.js public folder
    // Fix path: Go up 3 levels from 'stora/apps/runner' to reach root
    const destDir = path.resolve(process.cwd(), '../../../stora-platform/public/videos');
    const destPath = path.join(destDir, fileName);

    console.log(chalk.gray(`[Upload] Copying to local path: ${destPath}`));

    await fs.ensureDir(destDir);
    await fs.copy(filePath, destPath);
    
    console.log(chalk.green(`[Upload] Copied to public folder`));
    
    // Return the URL that Next.js will serve
    return `http://localhost:3000/videos/${fileName}`;
  }
}
