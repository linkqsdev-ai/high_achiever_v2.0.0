const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');
const HTMLMinifier = require('html-minifier').minify;

const sourceDir = __dirname;
const distDir = path.join(__dirname, 'dist');

const copyDirs = ['analytics', 'break', 'popup', 'libs'];
const rootFiles = ['background.js', 'manifest.json', 'offscreen.html', 'offscreen.js', 'icon16.png', 'icon32.png', 'icon48.png', 'icon128.png', 'Adhan.mp3'];

if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);

async function processFile(srcPath, destPath) {
    const ext = path.extname(srcPath).toLowerCase();
    
    if (['.png', '.mp3', '.json'].includes(ext)) {
        fs.copyFileSync(srcPath, destPath);
        return;
    }

    let content = fs.readFileSync(srcPath, 'utf8');

    try {
        if (ext === '.js') {
            if (srcPath.includes('.min.')) {
                fs.copyFileSync(srcPath, destPath);
                return;
            }
            const minified = await minify(content, { format: { comments: false } });
            fs.writeFileSync(destPath, minified.code || content);
        } else if (ext === '.css') {
            if (srcPath.includes('.min.')) {
                fs.copyFileSync(srcPath, destPath);
                return;
            }
            const minified = new CleanCSS({}).minify(content);
            fs.writeFileSync(destPath, minified.styles || content);
        } else if (ext === '.html') {
            const minified = HTMLMinifier(content, {
                collapseWhitespace: true,
                removeComments: true,
                minifyCSS: true,
                minifyJS: true
            });
            fs.writeFileSync(destPath, minified);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
        console.log(`Processed: ${srcPath} -> ${destPath}`);
    } catch (err) {
        console.error(`Error processing ${srcPath}:`, err);
        fs.copyFileSync(srcPath, destPath);
    }
}

async function processDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            await processDir(srcPath, destPath);
        } else {
            await processFile(srcPath, destPath);
        }
    }
}

async function build() {
    console.log('Starting build process...');
    for (let file of rootFiles) {
        const src = path.join(sourceDir, file);
        if (fs.existsSync(src)) {
            await processFile(src, path.join(distDir, file));
        }
    }
    for (let dir of copyDirs) {
        const src = path.join(sourceDir, dir);
        if (fs.existsSync(src)) {
            await processDir(src, path.join(distDir, dir));
        }
    }
    console.log('Build completed! Optimized files are in the dist/ folder.');
}

build();
