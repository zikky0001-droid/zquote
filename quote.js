/**
 * Quote Generation Route
 * POST /api/quote
 * WITH TIMER & UPTIME
 */

import express from 'express';
import axios from 'axios';
import { generateQuote } from './renderer.js';
import { saveImage, getImageUrl, getImageMetadata } from './storage.js';

const router = express.Router();

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

// ================================
// FORMAT UPTIME (Minutes & Seconds)
// ================================
function formatUptime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
}

router.post('/', async (req, res) => {
    // ✅ Start timer
    const startTime = Date.now();
    
    try {
        let { text, username, avatar } = req.body;

        // Validate required fields
        if (!text || !username) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: text, username',
                timestamp: getTimeInfo()
            });
        }

        // Validate text length
        if (text.length > 1000) {
            return res.status(400).json({
                success: false,
                error: `Text exceeds 1000 character limit (${text.length} chars)`,
                timestamp: getTimeInfo()
            });
        }

        // Validate avatar URL if provided
        if (avatar && avatar !== 'default' && avatar !== '') {
            try {
                await axios.head(avatar, { timeout: 5000 });
            } catch {
                console.log('[QUOTE] Avatar URL invalid, using default');
                avatar = 'default';
            }
        }

        if (!avatar || avatar === '') {
            avatar = 'default';
        }

        // Generate the quote image
        const imageBuffer = await generateQuote({
            text,
            username,
            avatar: avatar || 'default',
            color: getUsernameColor(username)
        });

        // Save image to storage
        const filename = await saveImage(imageBuffer);
        const metadata = getImageMetadata(filename);
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const imageUrl = `${baseUrl}/images/${filename}`;

        // ✅ Calculate time taken
        const endTime = Date.now();
        const timeTaken = (endTime - startTime) / 1000;

        // ✅ Get uptime
        const uptimeSeconds = process.uptime();
        const uptimeFormatted = formatUptime(uptimeSeconds);

        // ================================
        // RESPONSE WITH TIMER & UPTIME
        // ================================
        const response = {
            success: true,
            data: {
                image: {
                    url: imageUrl,
                    filename: filename,
                    expiresIn: 90,
                    created: metadata?.created || getTimeInfo(),
                    expires: metadata?.expires || formatExpiryTime(Date.now() + 90000)
                },
                quote: {
                    text: text,
                    username: username,
                    color: getUsernameColor(username),
                    length: text.length
                },
                api: {
                    version: '1.0.0',
                    timestamp: getTimeInfo(),
                    endpoint: '/api/quote',
                    // ✅ NEW: Timer & Uptime
                    performance: {
                        timeTaken: `${timeTaken.toFixed(2)}s`,
                        uptime: uptimeFormatted,
                        uptimeSeconds: uptimeSeconds
                    }
                }
            }
        };

        // Pretty print JSON
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(response, null, 2));

    } catch (error) {
        console.error('[QUOTE] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate quote',
            timestamp: getTimeInfo()
        });
    }
});

function getUsernameColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        '#FF8A65', '#FFB74D', '#4FC3F7', '#81C784',
        '#BA68C8', '#E57373', '#64B5F6', '#FFD54F',
        '#A1887F', '#90A4AE', '#4DD0E1', '#AED581',
        '#FF8A80', '#B39DDB', '#80CBC4', '#FFAB91'
    ];
    return colors[Math.abs(hash) % colors.length];
}

export default router;


