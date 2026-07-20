/**
 * Storage Management - Save, serve, and auto-cleanup images
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, 'storage/images');
const IMAGE_EXPIRY_MS = 90 * 1000; // 90 seconds (changed from 3 minutes)

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

// In-memory store for image metadata
const imageStore = new Map();

// ================================
// TIME HELPERS
// ================================
function getTimeInfo() {
    const now = new Date();
    const utcTime = now.toISOString();
    const localTime = new Date(now.getTime() + (60 * 60 * 1000)).toISOString().replace('Z', '+01:00');
    
    return {
        utc: utcTime,
        local: localTime,
        timestamp: now.getTime()
    };
}

function formatExpiryTime(expiresAt) {
    const date = new Date(expiresAt);
    const utc = date.toISOString();
    const local = new Date(date.getTime() + (60 * 60 * 1000)).toISOString().replace('Z', '+01:00');
    return { utc, local };
}

export async function saveImage(buffer) {
    const filename = crypto.randomBytes(8).toString('hex') + '.png';
    const filepath = path.join(STORAGE_DIR, filename);
    const now = Date.now();
    const expiresAt = now + IMAGE_EXPIRY_MS;

    fs.writeFileSync(filepath, buffer);

    const timeInfo = getTimeInfo();
    
    imageStore.set(filename, {
        filename,
        createdAt: now,
        expiresAt: expiresAt,
        created: timeInfo,
        expires: formatExpiryTime(expiresAt)
    });

    console.log(`[STORAGE] Image saved: ${filename} (expires in ${IMAGE_EXPIRY_MS/1000}s)`);
    console.log(`[STORAGE]   Created: ${timeInfo.local} (UTC+1) | ${timeInfo.utc} (UTC)`);
    console.log(`[STORAGE]   Expires: ${formatExpiryTime(expiresAt).local} (UTC+1) | ${formatExpiryTime(expiresAt).utc} (UTC)`);

    return filename;
}

export function getImageUrl(filename) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/images/${filename}`;
}

export function getImageMetadata(filename) {
    return imageStore.get(filename) || null;
}

export function deleteImage(filename) {
    const filepath = path.join(STORAGE_DIR, filename);
    if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
    }
    imageStore.delete(filename);
    console.log(`[STORAGE] Deleted: ${filename}`);
}

export function startCleanup() {
    setInterval(() => {
        const now = Date.now();
        const toDelete = [];

        for (const [filename, metadata] of imageStore.entries()) {
            if (now > metadata.expiresAt) {
                toDelete.push(filename);
            }
        }

        for (const filename of toDelete) {
            deleteImage(filename);
        }

        if (toDelete.length > 0) {
            console.log(`[CLEANUP] Removed ${toDelete.length} expired images (${IMAGE_EXPIRY_MS/1000}s expiry)`);
        }
    }, 30000); // Check every 30 seconds (more frequent for 90s expiry)
}

export function cleanupOnShutdown() {
    for (const filename of imageStore.keys()) {
        deleteImage(filename);
    }
    console.log('[CLEANUP] All images deleted on shutdown');
}




