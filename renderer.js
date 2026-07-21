/**
 * Quote Renderer - SVG to PNG
 * STICKER-OPTIMIZED: Large bubble, black background, neon glow
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
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
// CONSTANTS (STICKER-OPTIMIZED)
// ================================
const IMAGE_WIDTH = 1200;
const AVATAR_SIZE = 145;            // ← Bigger avatar
const USERNAME_FONT_SIZE = 42;      // ← Bigger username
const MESSAGE_FONT_SIZE = 56;       // ← Bigger message
const BUBBLE_PADDING_TOP = 40;      // ← More padding
const BUBBLE_PADDING_BOTTOM = 40;
const BUBBLE_PADDING_LEFT = 48;
const BUBBLE_PADDING_RIGHT = 48;
const BUBBLE_RADIUS = 56;           // ← More rounded
const MAX_BUBBLE_WIDTH = 1040;      // ← Much wider bubble
const MAX_HEIGHT = 1400;
const MIN_HEIGHT = 300;
const MAX_CHARS = 1000;
const CHARS_PER_LINE = 26;

// Colors (Neon Purple Theme)
const COLORS = {
    background: '#000000',           // Black background
    bubble: '#1F1438',               // Dark purple
    bubbleGlow: 'rgba(138, 43, 226, 0.3)', // Neon glow
    username: '#FFB74D',             // Orange/Gold
    text: '#FFFFFF',                 // White text
    accent: '#A855F7',               // Neon purple accent
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
    
    const usernameHeight = USERNAME_FONT_SIZE + 18;
    const messageHeight = estimatedLines * lineHeight;
    const paddingTotal = BUBBLE_PADDING_TOP + BUBBLE_PADDING_BOTTOM + 10;
    const bubbleHeight = usernameHeight + messageHeight + paddingTotal;
    
    const finalBubbleHeight = Math.min(Math.max(bubbleHeight, MIN_HEIGHT), MAX_HEIGHT);
    const canvasHeight = finalBubbleHeight + 80; // Extra padding for sticker feel
    
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
// GENERATE QUOTE (STICKER-OPTIMIZED)
// ================================
export async function generateQuote({ text, username, avatar, color }) {
    const finalText = truncateText(text);
    const isTruncated = finalText !== text;
    
    const { canvasHeight, lines } = calculateHeight(finalText, username);
    const messageNode = await buildMessageNode(finalText, MESSAGE_FONT_SIZE);

    // ================================
    // GENERATE SVG
    // ================================
    const svg = await satori(
        {
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    alignItems: 'center',      // ← Centered vertically
                    justifyContent: 'center',  // ← Centered horizontally
                    padding: '40px',           // ← More padding around edges
                    background: COLORS.background,
                    fontFamily: '"Roboto", "Noto Sans", "Noto Color Emoji", sans-serif',
                    width: IMAGE_WIDTH,
                    height: canvasHeight,
                },
                children: [
                    // ================================
                    // GLOW EFFECT (Box shadow replacement)
                    // ================================
                    {
                        type: 'div',
                        props: {
                            style: {
                                display: 'flex',
                                alignItems: 'flex-end',
                                gap: '24px',
                                padding: '20px',
                                borderRadius: BUBBLE_RADIUS + 8,
                                boxShadow: '0 0 60px rgba(138, 43, 226, 0.4)',
                                background: 'rgba(138, 43, 226, 0.05)',
                            },
                            children: [
                                // ================================
                                // AVATAR (Larger)
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
                                            border: '4px solid #A855F7',
                                            boxShadow: '0 0 30px rgba(138, 43, 226, 0.5)',
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
                                                        background: '#3A3A3E',
                                                        fontSize: '52px',
                                                        fontWeight: 'bold',
                                                        color: COLORS.text,
                                                        fontFamily: '"Noto Sans", "Roboto", sans-serif',
                                                    },
                                                    children: username.charAt(0).toUpperCase(),
                                                },
                                            }
                                        ],
                                    },
                                },
                                // ================================
                                // BUBBLE (Neon Purple)
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
                                            boxShadow: '0 0 40px rgba(138, 43, 226, 0.3), inset 0 0 60px rgba(138, 43, 226, 0.05)',
                                            alignSelf: 'center',
                                        },
                                        children: [
                                            // ================================
                                            // TAIL (Neon Purple)
                                            // ================================
                                            {
                                                type: 'svg',
                                                props: {
                                                    width: 28,
                                                    height: 28,
                                                    style: {
                                                        position: 'absolute',
                                                        left: -14,
                                                        bottom: 24,
                                                    },
                                                    children: [
                                                        {
                                                            type: 'path',
                                                            props: {
                                                                d: "M22 0 C13 2 6 9 2 22 C12 18 18 14 22 9 Z",
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
                                                        marginBottom: '12px',
                                                        fontFamily: '"Noto Sans", "Roboto", sans-serif',
                                                    },
                                                    children: username,
                                                },
                                            },
                                            // Message
                                            messageNode,
                                            // Truncation notice
                                            ...(isTruncated ? [{
                                                type: 'div',
                                                props: {
                                                    style: {
                                                        display: 'flex',
                                                        fontSize: 18,
                                                        color: '#666666',
                                                        marginTop: 8,
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
    // RENDER SVG TO PNG
    // ================================
    const resvg = new Resvg(svg, {
        fitTo: {
            mode: 'width',
            value: IMAGE_WIDTH,
        },
        font: {
            loadSystemFonts: false,
            fontFiles: (() => {
                if (!fs.existsSync(FONTS_DIR)) return [];
                return fs.readdirSync(FONTS_DIR)
                    .filter(file => file.endsWith('.ttf') || file.endsWith('.otf'))
                    .map(file => path.join(FONTS_DIR, file));
            })(),
        },
    });

    const pngData = resvg.render();
    return pngData.asPng();
}

