/**
 * Quote Renderer - SVG to PNG
 * Visual improvements: avatar, tail, fit-content, padding, height estimation
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
// CONSTANTS (EXTRA LARGE)
// ================================
const IMAGE_WIDTH = 1200;           // ← Was 900 (33% larger)
const AVATAR_SIZE = 120;            // ← Was 80 (50% larger)
const USERNAME_FONT_SIZE = 36;      // ← Was 24 (50% larger)
const MESSAGE_FONT_SIZE = 48;       // ← Was 32 (50% larger)
const BUBBLE_PADDING_TOP = 28;      // ← Was 18
const BUBBLE_PADDING_BOTTOM = 28;   // ← Was 18
const BUBBLE_PADDING_LEFT = 36;     // ← Was 24
const BUBBLE_PADDING_RIGHT = 36;    // ← Was 24
const BUBBLE_RADIUS = 48;           // ← Was 38
const MAX_BUBBLE_WIDTH = 850;       // ← Was 620
const MIN_HEIGHT = 200;
const MAX_HEIGHT = 1200;            // ← Was 800
const MAX_CHARS = 1000; 
const CHARS_PER_LINE = 30;  

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
                    color: '#FFFFFF',
                    fontWeight: 400,
                    lineHeight: 1.4,
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
                            color: '#FFFFFF',
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
                            color: '#FFFFFF',
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
                    color: '#FFFFFF',
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
                gap: '2px',
                fontSize: fontSize,
                color: '#FFFFFF',
                fontWeight: 400,
                lineHeight: 1.4,
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
    
    const usernameHeight = USERNAME_FONT_SIZE + 14;
    const messageHeight = estimatedLines * lineHeight;
    const paddingTotal = BUBBLE_PADDING_TOP + BUBBLE_PADDING_BOTTOM + 10;
    const bubbleHeight = usernameHeight + messageHeight + paddingTotal;
    
    const finalBubbleHeight = Math.min(Math.max(bubbleHeight, MIN_HEIGHT), MAX_HEIGHT);
    
    // ✅ THIS IS THE HEIGHT YOU WANT TO ADJUST
    const canvasHeight = finalBubbleHeight + 40; 
    
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

    // ================================
    // GENERATE SVG
    // ================================
    const svg = await satori(
        {
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '18px',
                    // ✅ IMPROVEMENT 5: Reduce outer padding (20px → 14px)
                    padding: '14px',
                    background: 'transparent',
                    fontFamily: '"Roboto", "Noto Sans", "Noto Color Emoji", sans-serif',
                    width: IMAGE_WIDTH,
                },
                children: [
                    // ================================
                    // AVATAR (✅ IMPROVEMENT 1: marginBottom 10 → 8)
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
                                boxShadow: '0 0 0 4px rgba(255,255,255,0.08)',
                                alignSelf: 'flex-end',
                                marginBottom: 8,
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
                                            fontSize: '36px',
                                            fontWeight: 'bold',
                                            color: '#FFFFFF',
                                            fontFamily: '"Noto Sans", "Roboto", sans-serif',
                                        },
                                        children: username.charAt(0).toUpperCase(),
                                    },
                                }
                            ],
                        },
                    },
                    // ================================
                    // BUBBLE (✅ IMPROVEMENT 3: fit-content)
                    // ================================
                    {
                        type: 'div',
                        props: {
                            style: {
                                display: 'flex',
                                flexDirection: 'column',
                                background: '#2B2D31',
                                paddingTop: BUBBLE_PADDING_TOP,
                                paddingBottom: BUBBLE_PADDING_BOTTOM,
                                paddingLeft: BUBBLE_PADDING_LEFT,
                                paddingRight: BUBBLE_PADDING_RIGHT,
                                borderRadius: BUBBLE_RADIUS,
                                position: 'relative',
                                maxWidth: MAX_BUBBLE_WIDTH,
                                boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                                alignSelf: 'flex-start',
                            },
                            children: [
                                // ================================
                                // TAIL (✅ IMPROVEMENT 2: Smoother path)
                                // ================================
                                {
                                    type: 'svg',
                                    props: {
                                        width: 24,
                                        height: 24,
                                        style: {
                                            position: 'absolute',
                                            left: -12,
                                            bottom: 18,
                                        },
                                        children: [
                                            {
                                                type: 'path',
                                                props: {
                                                    d: "M22 0 C13 2 6 9 2 22 C12 18 18 14 22 9 Z",
                                                    fill: '#2B2D31',
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
                                            color: color,
                                            marginBottom: '10px',
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
                                            fontSize: 14,
                                            color: '#666666',
                                            marginTop: 4,
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






