/**
 * Quote Renderer - SVG to PNG
 * Uses Satori + Resvg for high-quality rendering
 * Loads ALL available fonts from /fonts folder
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================
// FONTS DIRECTORY
// ================================
const FONTS_DIR = path.join(__dirname, 'fonts');

// ================================
// LOAD ALL FONTS FROM FONTS FOLDER
// ================================
function loadAllFonts() {
    const fontMap = new Map();
    
    if (!fs.existsSync(FONTS_DIR)) {
        console.warn('[FONTS] Fonts directory not found:', FONTS_DIR);
        return fontMap;
    }

    const fontFiles = fs.readdirSync(FONTS_DIR).filter(file => 
        file.endsWith('.ttf') || file.endsWith('.otf') || file.endsWith('.ttc')
    );

    console.log(`[FONTS] Found ${fontFiles.length} font files`);

    for (const file of fontFiles) {
        try {
            const filepath = path.join(FONTS_DIR, file);
            const data = fs.readFileSync(filepath);
            
            // Parse font name from filename
            let name = file.replace(/\.(ttf|otf|ttc)$/, '');
            let weight = 400;
            let style = 'normal';

            // Detect weight from filename
            if (name.includes('Black')) weight = 900;
            else if (name.includes('ExtraBold')) weight = 800;
            else if (name.includes('Bold')) weight = 700;
            else if (name.includes('SemiBold')) weight = 600;
            else if (name.includes('Medium')) weight = 500;
            else if (name.includes('Regular')) weight = 400;
            else if (name.includes('Light')) weight = 300;
            else if (name.includes('ExtraLight')) weight = 200;
            else if (name.includes('Thin')) weight = 100;

            // Detect style
            if (name.includes('Italic')) style = 'italic';

            // Clean up name for Satori
            let fontName = 'Roboto';
            if (name.includes('Condensed')) fontName = 'Roboto Condensed';
            else if (name.includes('SemiCondensed')) fontName = 'Roboto SemiCondensed';

            fontMap.set(file, {
                name: fontName,
                data: data,
                weight: weight,
                style: style,
                file: file
            });

            console.log(`[FONTS] Loaded: ${file} (${fontName}, weight: ${weight}, style: ${style})`);
        } catch (error) {
            console.error(`[FONTS] Failed to load: ${file}`, error.message);
        }
    }

    return fontMap;
}

// ================================
// LOAD SPECIFIC FONTS (Priority)
// ================================
function loadSpecificFonts() {
    const fonts = [];

    // Priority order: Regular, Bold, then everything else
    const priorityFiles = [
        'Roboto-Regular.ttf',
        'Roboto-Bold.ttf',
        'NotoSans-Regular.ttf',
        'NotoColorEmoji-Regular.ttf'
    ];

    // Load priority fonts first
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

                // Special handling
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

    // Load ALL other fonts from the folder
    if (fs.existsSync(FONTS_DIR)) {
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
    }

    return fonts;
}

// ================================
// LOAD ALL FONTS
// ================================
const allFonts = loadSpecificFonts();

console.log(`[FONTS] Total fonts loaded: ${allFonts.length}`);

// ================================
// GENERATE QUOTE
// ================================
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
                                padding: '22px 28px',
                                borderRadius: '32px',
                                position: 'relative',
                                maxWidth: '470px',
                                minWidth: '200px',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
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
                                            fontFamily: '"Roboto", "Noto Sans", sans-serif',
                                        },
                                        children: username,
                                    },
                                },
                                // Message text
                                {
                                    type: 'div',
                                    props: {
                                        style: {
                                            display: 'flex',
                                            fontSize: 'auto',
                                            lineHeight: '1.3',
                                            color: '#FFFFFF',
                                            fontWeight: 400,
                                            wordBreak: 'break-word',
                                            fontFamily: '"Roboto", "Noto Sans", "Noto Color Emoji", sans-serif',
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
            fonts: allFonts,
        }
    );

    // ================================
    // RENDER SVG TO PNG
    // ================================
    const resvg = new Resvg(svg, {
        fitTo: {
            mode: 'width',
            value: 600,
        },
        font: {
            loadSystemFonts: false,
            fontFiles: (() => {
                // Collect all font files from fonts directory
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



