/**
 * Quote Generation Route
 * POST /api/quote
 */

import express from 'express';
import { generateQuote } from './renderer.js';
import { saveImage, getImageUrl } from './storage.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { text, username, avatar } = req.body;

        // Validate required fields
        if (!text || !username) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: text, username'
            });
        }

        // Validate text length (max 500 chars)
        if (text.length > 500) {
            return res.status(400).json({
                success: false,
                error: 'Text exceeds 500 character limit'
            });
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

        // Return response
        res.json({
            success: true,
            expiresIn: 180,
            image: getImageUrl(filename),
            preview: getImageUrl(filename),
            filename
        });

    } catch (error) {
        console.error('[QUOTE] Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate quote'
        });
    }
});

function getUsernameColor(username) {
    // Consistent color based on username
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


