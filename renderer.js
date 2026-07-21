/**
 * Quote Renderer - SVG to PNG (FAST - Using Sharp)
 * Multiple Color Themes: Purple, Yellow, Red, Blue, Green, Orange, Pink, Gold
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
// CONSTANTS
// ================================
const IMAGE_WIDTH = 1800;
const AVATAR_SIZE = 220;
const USERNAME_FONT_SIZE = 80;
const MESSAGE_FONT_SIZE = 100;
const BUBBLE_PADDING_TOP = 56;
const BUBBLE_PADDING_BOTTOM = 56;
const BUBBLE_PADDING_LEFT = 64;
const BUBBLE_PADDING_RIGHT = 64;
const BUBBLE_RADIUS = 72;
const MAX_BUBBLE_WIDTH = 1500;
const MAX_HEIGHT = 2200;
const MIN_HEIGHT = 450;
const MAX_CHARS = 1000;
const CHARS_PER_LINE = 26;

// ================================
// 🎨 COLOR THEMES
// ================================
const THEMES = {
    // --- Purple Theme (Default) ---
    purple: {
        bubble: '#6C2BD9',
        bubbleDark: '#4A1A8A',
        username: '#D4A017',
        text: '#FFFFFF',
        glow: 'rgba(108, 43, 217, 0.4)',
        border: '#8B5CF6',
        shadow: 'rgba(108, 43, 217, 0.3)',
    },
    // --- White Bubble + Blue Glow ---
    whiteBlue: {
        bubble: '#FFFFFF',
        bubbleDark: '#F0F0F0',
        username: '#1A237E',
        text: '#1A1A2E',
        glow: 'rgba(37, 99, 235, 0.5)',
        border: '#3B82F6',
        shadow: 'rgba(37, 99, 235, 0.25)',
    },
    // --- Yellow Theme ---
    yellow: {
        bubble: '#F59E0B',
        bubbleDark: '#D97706',
        username: '#1F2937',
        text: '#FFFFFF',
        glow: 'rgba(245, 158, 11, 0.4)',
        border: '#FBBF24',
        shadow: 'rgba(245, 158, 11, 0.3)',
    },
    // --- Red Theme ---
    red: {
        bubble: '#DC2626',
        bubbleDark: '#991B1B',
        username: '#FCD34D',
        text: '#FFFFFF',
        glow: 'rgba(220, 38, 38, 0.4)',
        border: '#EF4444',
        shadow: 'rgba(220, 38, 38, 0.3)',
    },
    // --- Blue Theme ---
    blue: {
        bubble: '#2563EB',
        bubbleDark: '#1E40AF',
        username: '#FCD34D',
        text: '#FFFFFF',
        glow: 'rgba(37, 99, 235, 0.4)',
        border: '#3B82F6',
        shadow: 'rgba(37, 99, 235, 0.3)',
    },
    // --- Green Theme ---
    green: {
        bubble: '#16A34A',
        bubbleDark: '#15803D',
        username: '#FCD34D',
        text: '#FFFFFF',
        glow: 'rgba(22, 163, 74, 0.4)',
        border: '#22C55E',
        shadow: 'rgba(22, 163, 74, 0.3)',
    },
    // --- Orange Theme ---
    orange: {
        bubble: '#EA580C',
        bubbleDark: '#9A3412',
        username: '#FCD34D',
        text: '#FFFFFF',
        glow: 'rgba(234, 88, 12, 0.4)',
        border: '#F97316',
        shadow: 'rgba(234, 88, 12, 0.3)',
    },
    // --- Pink Theme ---
    pink: {
        bubble: '#DB2777',
        bubbleDark: '#9D174D',
        username: '#FCD34D',
        text: '#FFFFFF',
        glow: 'rgba(219, 39, 119, 0.4)',
        border: '#EC4899',
        shadow: 'rgba(219, 39, 119, 0.3)',
    },
    // --- Gold Theme ---
    gold: {
        bubble: '#D4A017',
        bubbleDark: '#B8860B',
        username: '#D4A017',
        text: '#FFFFFF',
        glow: 'rgba(212, 160, 23, 0.4)',
        border: '#FCD34D',
        shadow: 'rgba(212, 160, 23, 0.3)',
    },
};

// ================================
// 🔧 SELECT YOUR THEME HERE
// ================================
// Options: 'purple', 'yellow', 'red', 'blue', 'green', 'orange', 'pink', 'gold'
const SELECTED_THEME = 'whiteBlue';  // ← Change this to switch themes

// ================================
// 🎨 GLOW SETTINGS
// ================================
const GLOW_ENABLED = true;  // ← Set to false to disable glow

// ================================
// LOAD THEME COLORS
// ================================
const theme = THEMES[SELECTED_THEME] || THEMES.purple;

const COLORS = {
    background: '#0A0A0F',
    bubble: theme.bubble,
    bubbleDark: theme.bubbleDark,
    username: theme.username,
    text: theme.text,
    border: theme.border,
    shadow: theme.shadow,
    glow: theme.glow,
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
                let weight = 400;
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
            let weight = 400;
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
console.log(`[THEME] Using: ${SELECTED_THEME.toUpperCase()} theme`);
console.log(`[GLOW] ${GLOW_ENABLED ? 'ENABLED' : 'DISABLED'}`);

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
async function buildMessageNode(text, fontSize) {
    if (!hasEmoji(text)) {
        return {
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    fontSize: fontSize,
                    color: COLORS.text,
                    fontWeight: 400,
                    lineHeight: 1.5,
                    fontFamily: '"Roboto", "Noto Sans", sans-serif',
                    flexWrap: 'wrap',
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
                            fontWeight: 400,
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
                            fontWeight: 400,
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
                    fontWeight: 400,
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
                fontWeight: 400,
                lineHeight: 1.5,
                fontFamily: '"Roboto", "Noto Sans", sans-serif',
                maxWidth: MAX_BUBBLE_WIDTH - BUBBLE_PADDING_LEFT - BUBBLE_PADDING_RIGHT,
            },
            children: children,
        },
    };
}

// ================================
// CALCULATE HEIGHT
// ================================
function calculateHeight(text, username) {
    const lineHeight = MESSAGE_FONT_SIZE * 1.5;
    const charsPerLine = CHARS_PER_LINE;
    
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
    
    const usernameHeight = USERNAME_FONT_SIZE + 20;
    const messageHeight = estimatedLines * lineHeight;
    const paddingTotal = BUBBLE_PADDING_TOP + BUBBLE_PADDING_BOTTOM + 10;
    const bubbleHeight = usernameHeight + messageHeight + paddingTotal;
    
    const finalBubbleHeight = Math.min(Math.max(bubbleHeight, MIN_HEIGHT), MAX_HEIGHT);
    const canvasHeight = finalBubbleHeight + 80;
    
    return {
        bubbleHeight: finalBubbleHeight,
        canvasHeight: canvasHeight,
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
// GENERATE QUOTE
// ================================
export async function generateQuote({ text, username, avatar, color }) {
    const finalText = truncateText(text);
    const isTruncated = finalText !== text;
    
    const { canvasHeight, lines } = calculateHeight(finalText, username);
    const messageNode = await buildMessageNode(finalText, MESSAGE_FONT_SIZE);

    // Build glow effect based on settings
    const glowStyle = GLOW_ENABLED ? {
        boxShadow: `0 0 60px ${COLORS.glow}`,
        background: `rgba(108, 43, 217, 0.05)`,
    } : {
        boxShadow: 'none',
        background: 'transparent',
    };

    // ================================
    // GENERATE SVG
    // ================================
    const svg = await satori(
        {
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '50px',
                    background: COLORS.background,
                    fontFamily: '"Roboto", "Noto Sans", "Noto Color Emoji", sans-serif',
                    width: IMAGE_WIDTH,
                    height: canvasHeight,
                },
                children: [
                    {
                        type: 'div',
                        props: {
                            style: {
                                display: 'flex',
                                alignItems: 'flex-end',
                                gap: '28px',
                                padding: '24px',
                                borderRadius: BUBBLE_RADIUS + 8,
                                ...glowStyle,
                            },
                            children: [
                                // ================================
                                // AVATAR
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
                                            border: `6px solid ${COLORS.bubble}`,
                                            boxShadow: `0 0 40px ${COLORS.shadow}`,
                                            clipPath: 'inset(0 round 50%)',
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
                                                        width: '100%',
                                                        height: '100%',
                                                        background: '#2A2A3A',
                                                        fontSize: '72px',
                                                        fontWeight: 'bold',
                                                        color: COLORS.text,
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
                                // BUBBLE
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
                                            boxShadow: `0 0 60px ${COLORS.shadow}`,
                                            alignSelf: 'center',
                                        },
                                        children: [
                                            // Tail
                                            {
                                                type: 'svg',
                                                props: {
                                                    width: 32,
                                                    height: 32,
                                                    style: {
                                                        position: 'absolute',
                                                        left: -16,
                                                        bottom: 28,
                                                    },
                                                    children: [
                                                        {
                                                            type: 'path',
                                                            props: {
                                                                d: "M26 0 C15 3 7 11 2 26 C12 21 20 17 26 11 Z",
                                                                fill: COLORS.bubble,
                                                            },
                                                        },
                                                    ],
                                                },
                                            },
                                            // Username
                                            {
                                                type: 'div',
                                                props: {
                                                    style: {
                                                        display: 'flex',
                                                        fontSize: USERNAME_FONT_SIZE,
                                                        fontWeight: 700,
                                                        color: COLORS.username,
                                                        marginBottom: '16px',
                                                        fontFamily: '"Noto Sans", "Roboto", sans-serif',
                                                    },
                                                    children: username,
                                                },
                                            },
                                            // Message
                                            messageNode,
                                            ...(isTruncated ? [{
                                                type: 'div',
                                                props: {
                                                    style: {
                                                        display: 'flex',
                                                        fontSize: 24,
                                                        color: 'rgba(255,255,255,0.5)',
                                                        marginTop: 10,
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
            width: IMAGE_WIDTH,
            height: canvasHeight,
            fonts: allFonts,
        }
    );

    // ================================
    // RENDER SVG TO PNG using Sharp
    // ================================
    const pngBuffer = await sharp(Buffer.from(svg))
        .png({
            quality: 90,
            compressionLevel: 6,
        })
        .toBuffer();

    return pngBuffer;
}

