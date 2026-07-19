/**
 * Quote Renderer - SVG to PNG
 * Uses Satori + Resvg with Base64-encoded Twemoji SVGs
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

// ================================
// EMOJI CACHE
// ================================
const emojiCache = new Map();

// ================================
// LOAD FONTS
// ================================
function loadAllFonts() {
    const fonts = [];
    
    if (!fs.existsSync(FONTS_DIR)) {
        console.warn('[FONTS] Fonts directory not found');
        return fonts;
    }

    const fontFiles = fs.readdirSync(FONTS_DIR).filter(file => 
        file.endsWith('.ttf') || file.endsWith('.otf')
    );

    console.log(`[FONTS] Found ${fontFiles.length} font files`);

    for (const file of fontFiles) {
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
            if (file.includes('NotoSans')) name = 'Noto Sans';
            if (file.includes('NotoColorEmoji')) name = 'Noto Color Emoji';

            fonts.push({
                name: name,
                data: data,
                weight: weight,
                style: style,
                file: file
            });
        } catch (error) {
            console.error(`[FONTS] Failed to load: ${file}`, error.message);
        }
    }

    return fonts;
}

const allFonts = loadAllFonts();
console.log(`[FONTS] Total fonts loaded: ${allFonts.length}`);

// ================================
// EMOJI TO BASE64 SVG
// ================================
async function getEmojiBase64SVG(emoji) {
    // Check cache
    if (emojiCache.has(emoji)) {
        return emojiCache.get(emoji);
    }

    try {
        // Get Twemoji SVG URL
        const codePoint = twemoji.convert.toCodePoint(emoji);
        const svgUrl = `https://cdn.jsdelivr.net/npm/twemoji@14.1.2/svg/${codePoint}.svg`;

        // Download SVG
        const response = await axios.get(svgUrl, {
            responseType: 'text',
            timeout: 5000
        });

        const svgData = response.data;
        
        // Convert to Base64
        const base64 = Buffer.from(svgData).toString('base64');
        const dataUri = `data:image/svg+xml;base64,${base64}`;
        
        // Store in cache
        emojiCache.set(emoji, dataUri);
        return dataUri;
    } catch (error) {
        console.warn(`[EMOJI] Failed to get SVG for: ${emoji}`, error.message);
        return null;
    }
}

function parseEmojis(text) {
    const regex = emojiRegex();
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add text before emoji
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                value: text.slice(lastIndex, match.index)
            });
        }

        // Add emoji as image (will be resolved later)
        parts.push({
            type: 'emoji',
            value: match[0],
        });

        lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push({
            type: 'text',
            value: text.slice(lastIndex)
        });
    }

    return parts;
}

async function buildTextNode(parts, fontSize, color) {
    // Resolve emojis to Base64 SVGs
    const resolvedParts = await Promise.all(parts.map(async (part) => {
        if (part.type === 'text') {
            return part;
        } else {
            const svg = await getEmojiBase64SVG(part.value);
            return {
                ...part,
                svg: svg
            };
        }
    }));

    // Filter out emojis that failed to load
    const validParts = resolvedParts.filter(p => p.type === 'text' || p.svg);

    if (validParts.length === 1 && validParts[0].type === 'text') {
        return {
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    fontSize: fontSize,
                    lineHeight: '1.3',
                    color: color,
                    fontWeight: 400,
                    wordBreak: 'break-word',
                    fontFamily: '"Roboto", "Noto Sans", sans-serif',
                },
                children: validParts[0].value,
            },
        };
    }

    // Mixed text and emojis
    return {
        type: 'div',
        props: {
            style: {
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                fontSize: fontSize,
                lineHeight: '1.3',
                color: color,
                fontWeight: 400,
                fontFamily: '"Roboto", "Noto Sans", sans-serif',
                gap: '2px',
            },
            children: validParts.map((part) => {
                if (part.type === 'text') {
                    return {
                        type: 'span',
                        props: {
                            style: {
                                display: 'inline',
                                fontSize: fontSize,
                                color: color,
                            },
                            children: part.value,
                        },
                    };
                } else {
                    // Emoji as Base64 image
                    return {
                        type: 'img',
                        props: {
                            src: part.svg,
                            style: {
                                display: 'inline-block',
                                width: `${fontSize * 1.1}px`,
                                height: `${fontSize * 1.1}px`,
                                verticalAlign: 'middle',
                            },
                        },
                    };
                }
            }),
        },
    };
}

// ================================
// GENERATE QUOTE
// ================================
export async function generateQuote({ text, username, avatar, color }) {
    // Parse emojis in the message
    const textParts = parseEmojis(text);
    const textNode = await buildTextNode(textParts, 'auto', '#FFFFFF');

    // Build the SVG using Satori
    const svg = await satori(
        {
            type: 'div',
            props: {
                style: {
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '18px',
                    padding: '20px',
                    background: 'transparent',
                },
                children: [
                    // Avatar
                    {
                        type: 'div',
                        props: {
                            style: {
                                display: 'flex',
                                width: '72px',
                                height: '72px',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                flexShrink: 0,
                                boxShadow: '0 0 0 4px rgba(255,255,255,0.08)',
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
                                            fontSize: '28px',
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
                    // Bubble
                    {
                        type: 'div',
                        props: {
                            style: {
                                display: 'flex',
                                flexDirection: 'column',
                                background: '#2B2D31',
                                padding: '22px 28px',
                                borderRadius: '32px',
                                position: 'relative',
                                maxWidth: '470px',
                                minWidth: '200px',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
                            },
                            children: [
                                // Tail
                                {
                                    type: 'div',
                                    props: {
                                        style: {
                                            display: 'flex',
                                            position: 'absolute',
                                            left: '-18px',
                                            bottom: '14px',
                                            width: '28px',
                                            height: '28px',
                                            background: '#2B2D31',
                                            clipPath: 'path("M28 0C16 8 8 16 0 28C12 24 20 22 28 18Z")',
                                        },
                                    },
                                },
                                // Username
                                {
                                    type: 'div',
                                    props: {
                                        style: {
                                            display: 'flex',
                                            fontSize: '21px',
                                            fontWeight: 700,
                                            color: color,
                                            marginBottom: '8px',
                                            fontFamily: '"Noto Sans", "Roboto", sans-serif',
                                        },
                                        children: username,
                                    },
                                },
                                // Message text with emoji support
                                textNode,
                            ],
                        },
                    },
                ],
            },
        },
        {
            width: 600,
            height: 200,
            fonts: allFonts,
        }
    );

    // Render SVG to PNG
    const resvg = new Resvg(svg, {
        fitTo: {
            mode: 'width',
            value: 600,
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

