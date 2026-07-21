/**
 * Quote Renderer - SVG to PNG (FINAL STICKER VERSION)
 * Clean transparent design, large bubble, perfect proportions
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import satori from 'satori';
import sharp from 'sharp';
import twemoji from 'twemoji';
import emojiRegex from 'emoji-regex';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================
// FONTS DIRECTORY
// ================================
const FONTS_DIR = path.join(__dirname, 'fonts');
const EMOJI_CACHE_DIR = path.join(__dirname, 'emoji-cache');

if (!fs.existsSync(EMOJI_CACHE_DIR)) {
    fs.mkdirSync(EMOJI_CACHE_DIR, { recursive: true });
}

// ================================
// CONSTANTS (FINAL - BIGGER & FILLS CANVAS)
// ================================
const IMAGE_SIZE = 1024; 
const AVATAR_SIZE = 170;                
const USERNAME_FONT_SIZE = 53;  
const MESSAGE_FONT_SIZE = 70;  
const BUBBLE_PADDING_TOP = 22;   
const BUBBLE_PADDING_BOTTOM = 22;
const BUBBLE_PADDING_LEFT = 32;
const BUBBLE_PADDING_RIGHT = 32;
const BUBBLE_RADIUS = 48;  
const MAX_BUBBLE_WIDTH = 820;  
const MIN_BUBBLE_WIDTH = 400;   
const MAX_CHARS = 1000;
const CHARS_PER_LINE = 22;   

// Avatar alignment
const AVATAR_MARGIN_BOTTOM = 16;   
const GAP_BETWEEN_AVATAR_AND_BUBBLE = 12; 

// ================================
// TAIL SETTINGS (SHORTER, ROUNDER)
// ================================
const TAIL = {
    width: 18,
    height: 18,
    left: -7,
    bottom: 16,
    path: "M18 2 C13 3 8 6 4 12 C8 11 12 9 16 7 C17 6 18 4 18 2 Z",  // Soft teardrop
};

// ================================
// COLORS (Clean White Bubble)
// ================================
const COLORS = {
    bubble: '#FFFFFF',
    bubbleDark: '#F5F5F5',
    username: '#F59E0B',                // Orange/Gold
    text: '#222222',
    shadow: 'rgba(0, 0, 0, 0.08)',
    border: '#E5E7EB',
};

// ================================
// LOAD FONTS
// ================================
function loadSpecificFonts() {
    const fonts = [];

    if (!fs.existsSync(FONTS_DIR)) {
        console.warn('[FONTS] Fonts directory not found:', FONTS_DIR);
        return fonts;
    }

    const priorityFiles = [
        'Roboto-Regular.ttf',
        'Roboto-Bold.ttf',
        'NotoSans-Regular.ttf',
        'NotoColorEmoji-Regular.ttf'
    ];

    for (const file of priorityFiles) {
        const filepath = path.join(FONTS_DIR, file);
        if (fs.existsSync(filepath)) {
            try {
                const data = fs.readFileSync(filepath);
                let name = file.replace(/\.(ttf|otf|ttc)$/, '');
                let weight = 900;
                let style = 'normal';

                if (name.includes('Bold')) weight = 700;
                if (name.includes('Italic')) style = 'italic';

                if (file.includes('NotoSans')) name = 'Noto Sans';
                if (file.includes('NotoColorEmoji')) name = 'Noto Color Emoji';

                fonts.push({
                    name: name,
                    data: data,
                    weight: weight,
                    style: style,
                });
                console.log(`[FONTS] ✓ Priority loaded: ${file}`);
            } catch (error) {
                console.error(`[FONTS] Failed to load priority font: ${file}`, error.message);
            }
        }
    }

    const allFiles = fs.readdirSync(FONTS_DIR).filter(file => 
        (file.endsWith('.ttf') || file.endsWith('.otf')) && 
        !priorityFiles.includes(file) &&
        !file.includes('Noto')
    );

    for (const file of allFiles) {
        try {
            const filepath = path.join(FONTS_DIR, file);
            const data = fs.readFileSync(filepath);
            let name = 'Roboto';
            let weight = 900;
            let style = 'normal';

            if (file.includes('Black')) weight = 900;
            else if (file.includes('ExtraBold')) weight = 800;
            else if (file.includes('Bold')) weight = 700;
            else if (file.includes('SemiBold')) weight = 600;
            else if (file.includes('Medium')) weight = 500;
            else if (file.includes('Light')) weight = 300;
            else if (file.includes('ExtraLight')) weight = 200;
            else if (file.includes('Thin')) weight = 100;

            if (file.includes('Italic')) style = 'italic';
            if (file.includes('Condensed')) name = 'Roboto Condensed';
            if (file.includes('SemiCondensed')) name = 'Roboto SemiCondensed';

            fonts.push({
                name: name,
                data: data,
                weight: weight,
                style: style,
            });
            console.log(`[FONTS] ✓ Loaded: ${file}`);
        } catch (error) {
            console.error(`[FONTS] Failed to load: ${file}`, error.message);
        }
    }

    return fonts;
}

const allFonts = loadSpecificFonts();
console.log(`[FONTS] Total fonts loaded: ${allFonts.length}`);

// ================================
// EMOJI CACHE
// ================================
const memoryCache = new Map();
const TWEMOJI_CDN = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji/assets/svg';

async function getEmojiBase64SVG(emoji) {
    if (memoryCache.has(emoji)) {
        return memoryCache.get(emoji);
    }

    const codePoint = twemoji.convert.toCodePoint(emoji);
    const filename = `${codePoint}.svg`;
    const filepath = path.join(EMOJI_CACHE_DIR, filename);

    if (fs.existsSync(filepath)) {
        const svgData = fs.readFileSync(filepath, 'utf8');
        const base64 = Buffer.from(svgData).toString('base64');
        const dataUri = `data:image/svg+xml;base64,${base64}`;
        memoryCache.set(emoji, dataUri);
        return dataUri;
    }

    try {
        const svgUrl = `${TWEMOJI_CDN}/${codePoint}.svg`;
        const response = await axios.get(svgUrl, {
            responseType: 'text',
            timeout: 5000
        });

        const svgData = response.data;
        fs.writeFileSync(filepath, svgData, 'utf8');
        
        const base64 = Buffer.from(svgData).toString('base64');
        const dataUri = `data:image/svg+xml;base64,${base64}`;
        
        memoryCache.set(emoji, dataUri);
        return dataUri;
    } catch (error) {
        console.warn(`[EMOJI] Failed to get SVG for: ${emoji}`, error.message);
        return null;
    }
}

// ================================
// PARSE EMOJIS
// ================================
function hasEmoji(text) {
    const regex = emojiRegex();
    return regex.test(text);
}

function parseEmojis(text) {
    const regex = emojiRegex();
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                value: text.slice(lastIndex, match.index)
            });
        }
        parts.push({
            type: 'emoji',
            value: match[0],
        });
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        parts.push({
            type: 'text',
            value: text.slice(lastIndex)
        });
    }

    return parts;
}

// ================================
// BUILD MESSAGE NODE
// ================================
async function buildMessageNode(
    text,
    fontSize,
    charsPerLine = CHARS_PER_LINE
) {
    if (!hasEmoji(text)) {
        return {
            type: 'div',
            props: {
                style: {
    display: 'flex',
    fontSize: fontSize,
    color: COLORS.text,
    fontWeight: 900,
    lineHeight: 1.35,
    fontFamily: '"Roboto", "Noto Sans", sans-serif',
    flexWrap: 'wrap',
    maxWidth:
        (MAX_BUBBLE_WIDTH -
            BUBBLE_PADDING_LEFT -
            BUBBLE_PADDING_RIGHT) *
        (charsPerLine / CHARS_PER_LINE),
},
                children: text,
            },
        };
    }

    const parts = parseEmojis(text);
    const children = [];
    let textBuffer = '';

    for (const part of parts) {
        if (part.type === 'text') {
            textBuffer += part.value;
        } else {
            if (textBuffer) {
                children.push({
                    type: 'div',
                    props: {
                        style: {
                            display: 'flex',
                            fontSize: fontSize,
                            color: COLORS.text,
                            fontWeight: 900,
                            fontFamily: '"Roboto", "Noto Sans", sans-serif',
                        },
                        children: textBuffer,
                    },
                });
                textBuffer = '';
            }

            const svg = await getEmojiBase64SVG(part.value);
            if (svg) {
                const emojiSize = fontSize + 4;
                children.push({
                    type: 'img',
                    props: {
                        src: svg,
                        style: {
                            display: 'flex',
                            width: emojiSize,
                            height: emojiSize,
                            flexShrink: 0,
                        },
                    },
                });
            } else {
                children.push({
                    type: 'div',
                    props: {
                        style: {
                            display: 'flex',
                            fontSize: fontSize,
                            color: COLORS.text,
                            fontWeight: 900,
                            fontFamily: '"Roboto", "Noto Sans", sans-serif',
                        },
                        children: part.value,
                    },
                });
            }
        }
    }

    if (textBuffer) {
        children.push({
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    fontSize: fontSize,
                    color: COLORS.text,
                    fontWeight: 900,
                    fontFamily: '"Roboto", "Noto Sans", sans-serif',
                },
                children: textBuffer,
            },
        });
    }

    return {
        type: 'div',
        props: {
            style: {
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '4px',
                fontSize: fontSize,
                color: COLORS.text,
                fontWeight: 900,
                lineHeight: 1.35,
                fontFamily: '"Roboto", "Noto Sans", sans-serif',
                maxWidth:
    (charsPerLine / CHARS_PER_LINE) *
    (MAX_BUBBLE_WIDTH - BUBBLE_PADDING_LEFT - BUBBLE_PADDING_RIGHT),
            },
            children: children,
        },
    };
}

// ================================
// CALCULATE HEIGHT (For bubble only)
// ================================
function calculateHeight(
    text,
    username,
    fontSize = MESSAGE_FONT_SIZE,
    charsPerLine = CHARS_PER_LINE
) {
    const lineHeight = fontSize * 1.35;

    const words = text.split(' ');
    let lines = 1;
    let currentLineLength = 0;
    
    for (const word of words) {
        let wordLength = word.length;
        
        if (wordLength > charsPerLine) {
            lines += Math.floor(wordLength / charsPerLine);
            wordLength = wordLength % charsPerLine;
            if (wordLength === 0) continue;
            currentLineLength = 0;
        }
        
        if (currentLineLength + wordLength + 1 > charsPerLine) {
            lines++;
            currentLineLength = wordLength;
        } else {
            currentLineLength += wordLength + 1;
        }
    }
    
    const estimatedLines = Math.max(1, Math.ceil(lines * 1.1));
    
    const usernameHeight = USERNAME_FONT_SIZE + 12;
    const messageHeight = estimatedLines * lineHeight;
    const paddingTotal = BUBBLE_PADDING_TOP + BUBBLE_PADDING_BOTTOM + 10;
    const bubbleHeight = usernameHeight + messageHeight + paddingTotal;
    
    return {
        bubbleHeight: Math.max(bubbleHeight, 350),
        lines: estimatedLines,
    };
}

// ================================
// TRUNCATE TEXT
// ================================
function truncateText(text, maxLength = MAX_CHARS) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// ================================
// GENERATE QUOTE (FINAL)
// ================================
export async function generateQuote({ text, username, avatar, color }) {
    const finalText = truncateText(text);
    const isTruncated = finalText !== text;
    
    let messageFontSize = MESSAGE_FONT_SIZE;
let charsPerLine = CHARS_PER_LINE;

// Shrink font for longer messages
if (finalText.length > 150) messageFontSize = 64;
if (finalText.length > 250) messageFontSize = 58;
if (finalText.length > 400) messageFontSize = 52;
if (finalText.length > 600) messageFontSize = 46;

// Allow more characters per line as font gets smaller
if (messageFontSize <= 64) charsPerLine = 24;
if (messageFontSize <= 58) charsPerLine = 27;
if (messageFontSize <= 52) charsPerLine = 29;
if (messageFontSize <= 46) charsPerLine = 32;

const { bubbleHeight, lines } = calculateHeight(
    finalText,
    username,
    messageFontSize,
    charsPerLine
);

const messageNode = await buildMessageNode(
    finalText,
    messageFontSize,
    charsPerLine
);
    
    // ================================
    // GENERATE SVG - SQUARE, TRANSPARENT, CENTERED
    // ================================
    const svg = await satori(
        {
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    justifyContent: 'flex-start',
                    alignItems: 'center',
                    paddingTop: 40,
                    width: IMAGE_SIZE,
                    height: IMAGE_SIZE,
                    background: 'transparent',
                    fontFamily: '"Roboto", "Noto Sans", "Noto Color Emoji", sans-serif',
                },
                children: [
                    {
                        type: 'div',
                        props: {
                            style: {
                                display: 'flex',
                                alignItems: 'flex-end',
                                gap: GAP_BETWEEN_AVATAR_AND_BUBBLE,
                                maxWidth: MAX_BUBBLE_WIDTH + 80,
                            },
                            children: [
                                // ================================
                                // AVATAR (Large, aligned with bubble)
                                // ================================
                                {
                                    type: 'div',
                                    props: {
                                        style: {
                                            display: 'flex',
                                            width: AVATAR_SIZE,
                                            height: AVATAR_SIZE,
                                            borderRadius: '50%',
                                            overflow: 'hidden',
                                            flexShrink: 0,
                                            border: `4px solid ${COLORS.border}`,
                                            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                                            marginBottom: AVATAR_MARGIN_BOTTOM,
                                        },
                                        children: avatar && avatar !== 'default' ? [
                                            {
                                                type: 'img',
                                                props: {
                                                    src: avatar,
                                                    style: {
                                                        display: 'flex',
                                                        width: '100%',
                                                        height: '100%',
                                                        objectFit: 'cover',
                                                        borderRadius: '50%',
                                                    },
                                                },
                                            }
                                        ] : [
                                            {
                                                type: 'div',
                                                props: {
                                                    style: {
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '90%',
                                                        height: '90%',
                                                        background: '#E5E7EB',
                                                        fontSize: '64px',
                                                        fontWeight: 'bold',
                                                        color: '#9CA3AF',
                                                        fontFamily: '"Noto Sans", "Roboto", sans-serif',
                                                        borderRadius: '50%',
                                                    },
                                                    children: username.charAt(0).toUpperCase(),
                                                },
                                            }
                                        ],
                                    },
                                },
                                // ================================
                                // BUBBLE (White, clean, large)
                                // ================================
                                {
                                    type: 'div',
                                    props: {
                                        style: {
                                            display: 'flex',
                                            flexDirection: 'column',
                                            background: COLORS.bubble,
                                            paddingTop: BUBBLE_PADDING_TOP,
                                            paddingBottom: BUBBLE_PADDING_BOTTOM,
                                            paddingLeft: BUBBLE_PADDING_LEFT,
                                            paddingRight: BUBBLE_PADDING_RIGHT,
                                            borderRadius: BUBBLE_RADIUS,
                                            position: 'relative',
                                            maxWidth: MAX_BUBBLE_WIDTH,
                                            minWidth: MIN_BUBBLE_WIDTH,
                                            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                                            alignSelf: 'flex-start',
                                        },
                                        children: [
                                            // ================================
                                            // TAIL (Soft, rounded, short)
                                            // ================================
                                            {
                                                type: 'svg',
                                                props: {
                                                    width: TAIL.width,
                                                    height: TAIL.height,
                                                    style: {
                                                        position: 'absolute',
                                                        left: TAIL.left,
                                                        bottom: TAIL.bottom,
                                                    },
                                                    children: [
                                                        {
                                                            type: 'path',
                                                            props: {
                                                                d: TAIL.path,
                                                                fill: COLORS.bubble,
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Username (Orange/Gold)
                                            {
                                                type: 'div',
                                                props: {
                                                    style: {
                                                        display: 'flex',
                                                        fontSize: USERNAME_FONT_SIZE,
                                                        fontWeight: 900,
                                                        color: COLORS.username,
                                                        marginBottom: '16px',
                                                        fontFamily: '"Noto Sans", "Roboto", sans-serif',
                                                    },
                                                    children: username,
                                                },
                                            },
                                            // Message (Dark)
                                            messageNode,
                                            // Truncation notice
                                            ...(isTruncated ? [{
                                                type: 'div',
                                                props: {
                                                    style: {
                                                        display: 'flex',
                                                        fontSize: 16,
                                                        color: '#9CA3AF',
                                                        marginTop: 6,
                                                        fontFamily: '"Roboto", "Noto Sans", sans-serif',
                                                    },
                                                    children: '... (truncated)',
                                                },
                                            }] : []),
                                        ],
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        },
        {
            width: IMAGE_SIZE,
            height: IMAGE_SIZE,
            fonts: allFonts,
        }
    );

    // ================================
    // RENDER SVG TO PNG using Sharp (Transparent)
    // ================================
    const pngBuffer = await sharp(Buffer.from(svg))
        .png({
            quality: 90,
            compressionLevel: 6,
        })
        .toBuffer();

    return pngBuffer;
}


