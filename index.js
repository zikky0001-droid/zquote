/**
 * DEV ZIKKY Quote API
 * Telegram-style quote image generator
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Import routes and utils
import quoteRouter from './quote.js';
import { startCleanup } from './storage.js';

// ================================
// MIDDLEWARE
// ================================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================================
// STATIC FILES WITH HEADERS
// ================================
// Images (with CORS and cache)
app.use('/images', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=180');
    next();
}, express.static(path.join(__dirname, 'storage/images')));

// Fonts (if needed for direct access)
app.use('/fonts', express.static(path.join(__dirname, 'fonts')));

// ================================
// ROUTES
// ================================
app.use('/api/quote', quoteRouter);

// ================================
// LANDING PAGE
// ================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ================================
// HEALTH CHECK
// ================================
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        baseUrl: process.env.BASE_URL || `http://localhost:${PORT}`
    });
});

// ================================
// START CLEANUP
// ================================
startCleanup();

// ================================
// START SERVER
// ================================
app.listen(PORT, () => {
    console.log(`🚀 Quote API running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🔗 BASE_URL: ${process.env.BASE_URL || 'http://localhost:' + PORT}`);
});


