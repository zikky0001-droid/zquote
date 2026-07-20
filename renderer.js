/**
 * Quote Renderer - SVG to PNG
 * Uses Satori + Resvg for high-quality rendering
 * Loads ALL available fonts from /fonts folder
 * LARGER SIZE with ADAPTIVE FONT SIZING
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

// Create emoji cache directory
if (!fs.existsSync(EMOJI_CACHE_DIR)) {
    fs.mkdirSync(EMOJI_CACHE_DIR, { recursive: true });
}

// ================================
// SIZE SETTINGS
// ================================
const IMAGE_WIDTH = 900;
const AVATAR_SIZE = 100;
const USERNAME_FONT_SIZE = 32;
const BUBBLE_PADDING = 30;
const BUBBLE_RADIUS = 40;
const MAX_BUBBLE_WIDTH = 680;
const MIN_BUBBLE_WIDTH = 300;
const MAX_HEIGHT = 800;
const MIN_HEIGHT = 200;
const MAX_CHARS = 1000;

// Font size ranges for adaptive sizing
const MAX_MESSAGE_FONT_SIZE = 42;
const MIN_MESSAGE_FONT_SIZE = 16;
const LINE_HEIGHT_RATIO = 1.4;

// ================================
// LOAD ALL FONTS FROM FONTS FOLDER
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
// ADAPTIVE FONT SIZING (FIXED - No document)
// ================================
function calculateOptimalFontSize(text, maxWidth, maxHeight) {
    // Start with largest font size
    let fontSize = MAX_MESSAGE_FONT_SIZE;
    let lines = [];
    let textHeight = 0;
    let textWidth = 0;

    // Server-side text measurement (approximate)
    function measureTextWidth(str, size) {
        // Average character width ~ size * 0.55 for most fonts
        return str.length * size * 0.55;
    }

    while (fontSize >= MIN_MESSAGE_FONT_SIZE) {
        const lineHeight = fontSize * LINE_HEIGHT_RATIO;
        const maxCharsPerLine = Math.floor(maxWidth / (fontSize * 0.55));
        
        // Split text into lines
        lines = [];
        let currentLine = '';
        const words = text.split(' ');
        
        for (const word of words) {
            const testLine = currentLine + word + ' ';
            if (testLine.length > maxCharsPerLine && currentLine !== '') {
                lines.push(currentLine.trim());
                currentLine = word + ' ';
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine.trim());

        // Calculate total text height
        textHeight = lines.length * lineHeight;
        textWidth = Math.max(...lines.map(line => measureTextWidth(line, fontSize)));

        // Check if text fits
        if (textHeight <= maxHeight && textWidth <= maxWidth) {
            break;
        }

        // Reduce font size
        fontSize -= 2;
    }

    // If still doesn't fit at minimum size, truncate
    let truncated = false;
    let finalText = text;

    if (fontSize <= MIN_MESSAGE_FONT_SIZE && textHeight > maxHeight) {
        // Calculate how many lines fit
        const lineHeight = MIN_MESSAGE_FONT_SIZE * LINE_HEIGHT_RATIO;
        const maxLines = Math.floor(maxHeight / lineHeight);
        const maxCharsPerLine = Math.floor(maxWidth / (MIN_MESSAGE_FONT_SIZE * 0.55));
        const maxChars = maxLines * maxCharsPerLine;
        
        // Truncate text
        if (finalText.length > maxChars) {
            finalText = finalText.substring(0, maxChars - 3) + '...';
            truncated = true;
        }
        
        // Recalculate lines with truncated text
        lines = [];
        let currentLine = '';
        const words = finalText.split(' ');
        for (const word of words) {
            const testLine = currentLine + word + ' ';
            if (testLine.length > maxCharsPerLine && currentLine !== '') {
                lines.push(currentLine.trim());
                currentLine = word + ' ';
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine.trim());
    }

    return {
        fontSize: fontSize,
        lines: lines,
        truncated: truncated,
        finalText: finalText
    };
}

// ================================
// BUILD MESSAGE NODE (WITH EMOJIS & ADAPTIVE FONT)
// ================================
async function buildMessageNode(text, fontSize) {
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
                gap: '3px',
                fontSize: fontSize,
                color: '#FFFFFF',
                fontWeight: 400,
                lineHeight: LINE_HEIGHT_RATIO,
                fontFamily: '"Roboto", "Noto Sans", sans-serif',
            },
            children: children,
        },
    };
}

// ================================
// GENERATE QUOTE
// ================================
export async function generateQuote({ text, username, avatar, color }) {
    // ================================
    // STEP 1: CHARACTER LIMIT (1000)
    // ================================
    let processedText = text;
    if (processedText.length > MAX_CHARS) {
        processedText = processedText.substring(0, MAX_CHARS - 3) + '...';
        console.log(`[RENDERER] Text truncated from ${text.length} to ${processedText.length} chars`);
    }

    // ================================
    // STEP 2: CALCULATE ADAPTIVE FONT SIZE
    // ================================
    const maxTextWidth = MAX_BUBBLE_WIDTH - BUBBLE_PADDING * 2 - 10;
    const maxTextHeight = 600;
    
    const { fontSize, lines, truncated, finalText } = calculateOptimalFontSize(
        processedText,
        maxTextWidth,
        maxTextHeight
    );

    console.log(`[RENDERER] Font size: ${fontSize}px, Lines: ${lines.length}, Truncated: ${truncated}`);

    // ================================
    // STEP 3: CALCULATE HEIGHT
    // ================================
    const lineHeight = fontSize * LINE_HEIGHT_RATIO;
    const textHeight = lines.length * lineHeight;
    const usernameHeight = USERNAME_FONT_SIZE + 14;
    const paddingTotal = BUBBLE_PADDING * 2 + 10;
    const calculatedHeight = usernameHeight + textHeight + paddingTotal;
    const finalHeight = Math.min(Math.max(calculatedHeight, MIN_HEIGHT), MAX_HEIGHT);

    // ================================
    // STEP 4: BUILD MESSAGE NODE
    // ================================
    const messageNode = await buildMessageNode(finalText, fontSize);

    // ================================
    // STEP 5: GENERATE SVG
    // ================================
    const svg = await satori(
        {
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '24px',
                    padding: '30px',
                    background: 'transparent',
                    fontFamily: '"Roboto", "Noto Sans", "Noto Color Emoji", sans-serif',
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
                                boxShadow: '0 0 0 6px rgba(255,255,255,0.08)',
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
                                            fontSize: '40px',
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
                    // BUBBLE
                    // ================================
                    {
                        type: 'div',
                        props: {
                            style: {
                                display: 'flex',
                                flexDirection: 'column',
                                background: '#2B2D31',
                                padding: `${BUBBLE_PADDING}px ${BUBBLE_PADDING + 8}px`,
                                borderRadius: BUBBLE_RADIUS,
                                position: 'relative',
                                maxWidth: MAX_BUBBLE_WIDTH,
                                minWidth: MIN_BUBBLE_WIDTH,
                                boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                                fontFamily: '"Roboto", "Noto Sans", "Noto Color Emoji", sans-serif',
                            },
                            children: [
                                // Tail
                                {
                                    type: 'div',
                                    props: {
                                        style: {
                                            display: 'flex',
                                            position: 'absolute',
                                            left: '-24px',
                                            bottom: '18px',
                                            width: '38px',
                                            height: '38px',
                                            background: '#2B2D31',
                                            clipPath: 'path("M38 0C22 10 10 22 0 38C16 32 26 28 38 24Z")',
                                        },
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
                                            marginBottom: '12px',
                                            fontFamily: '"Noto Sans", "Roboto", sans-serif',
                                        },
                                        children: username,
                                    },
                                },
                                // Message text
                                messageNode,
                                // Truncation notice
                                ...(truncated ? [{
                                    type: 'div',
                                    props: {
                                        style: {
                                            display: 'flex',
                                            fontSize: fontSize * 0.7,
                                            color: '#888888',
                                            marginTop: '6px',
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
            height: finalHeight,
            fonts: allFonts,
        }
    );

    // ================================
    // STEP 6: RENDER SVG TO PNG
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


