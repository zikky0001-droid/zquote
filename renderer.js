/**
 * Quote Renderer - SVG to PNG
 * Uses Satori + Resvg for high-quality rendering
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load fonts from root directory
const REGULAR_FONT = path.join(__dirname, 'Roboto-Regular.ttf');
const BOLD_FONT = path.join(__dirname, 'Roboto-Bold.ttf');

async function loadFont(filepath) {
    if (fs.existsSync(filepath)) {
        return fs.readFileSync(filepath);
    }
    return null;
}

// Load fonts once
const regularFont = await loadFont(REGULAR_FONT);
const boldFont = await loadFont(BOLD_FONT);

export async function generateQuote({ text, username, avatar, color }) {
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
                                            width: '100%',
                                            height: '100%',
                                            background: '#3A3A3E',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '28px',
                                            fontWeight: 'bold',
                                            color: '#FFFFFF',
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
                                            fontSize: '21px',
                                            fontWeight: 700,
                                            color: color,
                                            marginBottom: '8px',
                                        },
                                        children: username,
                                    },
                                },
                                // Message text
                                {
                                    type: 'div',
                                    props: {
                                        style: {
                                            fontSize: 'auto',
                                            lineHeight: '1.3',
                                            color: '#FFFFFF',
                                            fontWeight: 400,
                                            wordBreak: 'break-word',
                                        },
                                        children: text,
                                    },
                                },
                            ],
                        },
                    },
                ],
            },
        },
        {
            width: 600,
            height: 200,
            fonts: [
                ...(regularFont ? [{
                    name: 'Roboto',
                    data: regularFont,
                    weight: 400,
                    style: 'normal',
                }] : []),
                ...(boldFont ? [{
                    name: 'Roboto',
                    data: boldFont,
                    weight: 700,
                    style: 'normal',
                }] : []),
            ],
        }
    );

    // Render SVG to PNG using Resvg
    const resvg = new Resvg(svg, {
        fitTo: {
            mode: 'width',
            value: 600,
        },
        font: {
            loadSystemFonts: false,
            fontFiles: [
                ...(fs.existsSync(REGULAR_FONT) ? [REGULAR_FONT] : []),
                ...(fs.existsSync(BOLD_FONT) ? [BOLD_FONT] : []),
            ],
        },
    });

    const pngData = resvg.render();
    return pngData.asPng();
}

