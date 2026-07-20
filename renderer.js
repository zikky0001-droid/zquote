/**
 * Quote Renderer - SVG to PNG
 * Let Satori handle layout naturally - no manual sizing
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
// CONSTANTS
// ================================
const IMAGE_WIDTH = 900;
const AVATAR_SIZE = 80;
const USERNAME_FONT_SIZE = 24;
const MESSAGE_FONT_SIZE = 32;
const BUBBLE_PADDING = 24;
const BUBBLE_RADIUS = 36;
const MAX_BUBBLE_WIDTH = 620;
const MIN_BUBBLE_WIDTH = 200;
const MAX_CHARS = 1000;

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
// BUILD MESSAGE NODE (Let Satori handle everything)
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
                    type: 'span',
                    props: {
                        style: {
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
                            display: 'inline-block',
                            width: emojiSize,
                            height: emojiSize,
                            verticalAlign: 'middle',
                        },
                    },
                });
            } else {
                children.push({
                    type: 'span',
                    props: {
                        style: {
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
            type: 'span',
            props: {
                style: {
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
                maxWidth: MAX_BUBBLE_WIDTH - BUBBLE_PADDING * 2,
            },
            children: children,
        },
    };
}

// ================================
// TRUNCATE TEXT (Simple)
// ================================
function truncateText(text, maxLength = MAX_CHARS) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// ================================
// GENERATE QUOTE - SIMPLIFIED
// ================================
export async function generateQuote({ text, username, avatar, color }) {
    // Simple truncation
    const finalText = truncateText(text);
    const isTruncated = finalText !== text;

    // Build message node with Satori handling layout
    const messageNode = await buildMessageNode(finalText, MESSAGE_FONT_SIZE);

    // ================================
    // GENERATE SVG - Let Satori handle sizing
    // ================================
    const svg = await satori(
        {
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '18px',
                    padding: '30px 30px 30px 20px',
                    background: 'transparent',
                    fontFamily: '"Roboto", "Noto Sans", "Noto Color Emoji", sans-serif',
                    width: IMAGE_WIDTH,
                },
                children: [
                    // ================================
                    // AVATAR (Bottom-aligned with bubble)
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
                                marginBottom: '0px',
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
                    // BUBBLE (Satori handles sizing)
                    // ================================
                    {
                        type: 'div',
                        props: {
                            style: {
                                display: 'flex',
                                flexDirection: 'column',
                                background: '#2B2D31',
                                padding: `${BUBBLE_PADDING}px ${BUBBLE_PADDING + 6}px`,
                                borderRadius: BUBBLE_RADIUS,
                                position: 'relative',
                                maxWidth: MAX_BUBBLE_WIDTH,
                                minWidth: MIN_BUBBLE_WIDTH,
                                boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
                                flexShrink: 0,
                            },
                            children: [
                                // ================================
                                // TAIL (Rounded SVG path)
                                // ================================
                                {
                                    type: 'div',
                                    props: {
                                        style: {
                                            display: 'flex',
                                            position: 'absolute',
                                            left: '-14px',
                                            bottom: '16px',
                                            width: '24px',
                                            height: '24px',
                                            background: '#2B2D31',
                                            borderRadius: '4px',
                                            transform: 'rotate(45deg)',
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
                                            marginBottom: '6px',
                                            fontFamily: '"Noto Sans", "Roboto", sans-serif',
                                        },
                                        children: username,
                                    },
                                },
                                // Message text (Satori handles wrapping)
                                messageNode,
                                // Truncation notice
                                ...(isTruncated ? [{
                                    type: 'div',
                                    props: {
                                        style: {
                                            display: 'flex',
                                            fontSize: '14px',
                                            color: '#666666',
                                            marginTop: '4px',
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
            height: 200, // Satori will auto-expand
            fonts: allFonts,
        }
    );

    // Render to PNG
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




