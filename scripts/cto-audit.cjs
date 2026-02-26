const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.vscode', 'supabase/.temp', '.gemini'];

const metrics = {
    totalFiles: 0,
    frontendComponents: 0,
    backendRoutes: 0,
    consoleLogs: 0,
    todos: 0,
    anyTypes: 0,
    largeFiles: [],
    orphanComponents: [],
    missingRls: 0,
    totalLines: 0,
};

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!IGNORE_DIRS.includes(file)) {
                walkDir(fullPath, callback);
            }
        } else {
            callback(fullPath);
        }
    }
}

function analyze() {
    const root = path.join(__dirname, '..');

    walkDir(root, (filepath) => {
        if (!filepath.endsWith('.ts') && !filepath.endsWith('.tsx') && !filepath.endsWith('.js') && !filepath.endsWith('.sql')) return;

        metrics.totalFiles++;
        const content = fs.readFileSync(filepath, 'utf8');
        const lines = content.split('\n');
        metrics.totalLines += lines.length;

        // Check size
        if (lines.length > 500) {
            metrics.largeFiles.push({ file: filepath.replace(root, ''), lines: lines.length });
        }

        // Frontend vs Backend
        if (filepath.includes('src\\components') || filepath.includes('src/components')) metrics.frontendComponents++;
        if (filepath.includes('services\\ai-calling\\src\\routes') || filepath.includes('services/ai-calling/src/routes')) metrics.backendRoutes++;

        // Issues
        metrics.consoleLogs += (content.match(/console\.log/g) || []).length;
        metrics.todos += (content.match(/TODO:/gi) || []).length;
        metrics.anyTypes += (content.match(/: any\b/g) || []).length;

        // DB
        if (filepath.endsWith('.sql')) {
            // Very naive check for RLS
            if (!content.includes('ENABLE ROW LEVEL SECURITY')) {
                metrics.missingRls++;
            }
        }
    });

    console.log(JSON.stringify(metrics, null, 2));
}

analyze();
