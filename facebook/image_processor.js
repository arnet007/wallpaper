const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ImageProcessor {
    constructor() {
        this.screenDimensions = null;
    }

    /**
     * Detects primary screen resolution using PowerShell
     */
    getScreenResolution() {
        if (this.screenDimensions) return this.screenDimensions;

        try {
            const cmd = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; Write-Output ($b.Width.ToString() + 'x' + $b.Height.ToString())"`;
            const output = execSync(cmd, { encoding: 'utf8' }).trim();
            const parts = output.split('x');
            if (parts.length === 2) {
                const width = parseInt(parts[0], 10);
                const height = parseInt(parts[1], 10);
                if (width > 0 && height > 0) {
                    this.screenDimensions = { width, height };
                    return this.screenDimensions;
                }
            }
        } catch (e) {
            // Fallback
        }

        this.screenDimensions = { width: 1920, height: 1080 };
        return this.screenDimensions;
    }

    /**
     * Creates an aesthetic Top-Right badge with Facebook Logo and Profile ID
     */
    createFacebookBadgeSvg(profileId) {
        const text = profileId ? profileId.replace(/^profile_/, 'ID: ') : 'Facebook';
        // Approximate character width for Segoe UI / Roboto font
        const charWidth = 10.5;
        const textWidth = Math.max(text.length * charWidth, 90);
        const badgeWidth = Math.round(textWidth + 72);
        const badgeHeight = 48;

        const svg = `
        <svg width="${badgeWidth}" height="${badgeHeight}" viewBox="0 0 ${badgeWidth} ${badgeHeight}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="rgba(15, 23, 42, 0.72)" />
                    <stop offset="100%" stop-color="rgba(30, 41, 59, 0.62)" />
                </linearGradient>
                <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="130%">
                    <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.4)" />
                </filter>
            </defs>

            <!-- Pill Background with soft border & shadow -->
            <rect x="2" y="2" width="${badgeWidth - 4}" height="${badgeHeight - 4}" rx="22" 
                  fill="url(#bgGrad)" stroke="rgba(255, 255, 255, 0.28)" stroke-width="1.2" filter="url(#dropShadow)" />

            <!-- Facebook Blue Circle Icon -->
            <circle cx="24" cy="24" r="14" fill="#1877F2" />
            
            <!-- Facebook White 'f' Logo -->
            <path d="M27.8 24.5h-2.5v9h-3.6v-9h-1.7v-3.1h1.7v-2c0-2.4 1.4-3.7 3.6-3.7 1 0 1.9.1 2.1.1v2.6h-1.4c-1.1 0-1.4.5-1.4 1.4v1.6h2.9l-.4 3.1z" fill="#FFFFFF" />

            <!-- Profile Name / ID Text -->
            <text x="47" y="30" fill="#FFFFFF" font-family="Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, sans-serif" 
                  font-size="16" font-weight="600" letter-spacing="0.4">
                ${text}
            </text>
        </svg>
        `;

        return {
            buffer: Buffer.from(svg),
            width: badgeWidth,
            height: badgeHeight
        };
    }

    /**
     * Checks if image is portrait / non-widescreen, fills sides with blurred version,
     * and adds the Facebook Logo + Profile ID badge in top right corner.
     * @param {string} inputPath Path to original downloaded image
     * @param {string} profileId Profile identifier (e.g. "rajnandinideyrj")
     * @returns {Promise<string>} Path to final wallpaper ready for desktop
     */
    async processForDesktop(inputPath, profileId = '') {
        const absoluteInput = path.resolve(inputPath);
        if (!fs.existsSync(absoluteInput)) {
            throw new Error(`Image file not found: ${absoluteInput}`);
        }

        const metadata = await sharp(absoluteInput).metadata();
        const imgWidth = metadata.width || 1080;
        const imgHeight = metadata.height || 1080;
        const imgAspectRatio = imgWidth / imgHeight;

        const screen = this.getScreenResolution();
        const screenWidth = Math.max(screen.width, 1920); // Minimum 1080p width for crisp desktop display
        const screenHeight = Math.max(screen.height, 1080);
        const screenAspectRatio = screenWidth / screenHeight;

        const isPortraitOrNarrow = imgAspectRatio < (screenAspectRatio - 0.2);

        const parsed = path.parse(absoluteInput);
        const outputPath = path.join(parsed.dir, `${parsed.name}_desktop${parsed.ext}`);

        // Generate Facebook Logo & Profile Badge
        const badge = this.createFacebookBadgeSvg(profileId);
        const badgeTop = 32;
        const badgeLeft = screenWidth - badge.width - 35; // Top-Right corner position

        console.log(`[ImageProcessor] Adding Facebook logo & profile badge "${profileId}" to Top-Right corner.`);

        if (isPortraitOrNarrow) {
            console.log(`[ImageProcessor] Detected portrait image (${imgWidth}x${imgHeight}, AR: ${imgAspectRatio.toFixed(2)}).`);
            console.log(`[ImageProcessor] Generating aesthetic widescreen wallpaper with blurred side fills (${screenWidth}x${screenHeight})...`);

            // 1. Generate blurred background (covers entire screen)
            const bgBuffer = await sharp(absoluteInput)
                .resize(screenWidth, screenHeight, {
                    fit: 'cover',
                    position: 'center'
                })
                .blur(35)
                .modulate({ brightness: 0.82 }) // Subtle darkening for high contrast
                .toBuffer();

            // 2. Resize foreground portrait to fit inside screen height without cropping
            const fgBuffer = await sharp(absoluteInput)
                .resize({
                    width: screenWidth,
                    height: screenHeight,
                    fit: 'inside'
                })
                .toBuffer();

            const fgMetadata = await sharp(fgBuffer).metadata();
            const fgWidth = fgMetadata.width || imgWidth;
            const fgHeight = fgMetadata.height || imgHeight;

            const fgLeft = Math.round((screenWidth - fgWidth) / 2);
            const fgTop = Math.round((screenHeight - fgHeight) / 2);

            // 3. Composite centered portrait + top-right Facebook badge over blurred background
            await sharp(bgBuffer)
                .composite([
                    {
                        input: fgBuffer,
                        left: Math.max(0, fgLeft),
                        top: Math.max(0, fgTop)
                    },
                    {
                        input: badge.buffer,
                        left: Math.max(0, badgeLeft),
                        top: badgeTop
                    }
                ])
                .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
                .toFile(outputPath);

        } else {
            // Landscape image: resize to screen and composite top-right Facebook badge
            const baseBuffer = await sharp(absoluteInput)
                .resize(screenWidth, screenHeight, {
                    fit: 'cover',
                    position: 'center'
                })
                .toBuffer();

            await sharp(baseBuffer)
                .composite([
                    {
                        input: badge.buffer,
                        left: Math.max(0, badgeLeft),
                        top: badgeTop
                    }
                ])
                .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
                .toFile(outputPath);
        }

        console.log(`[ImageProcessor] Desktop wallpaper ready: ${outputPath}`);
        return outputPath;
    }
}

module.exports = new ImageProcessor();
