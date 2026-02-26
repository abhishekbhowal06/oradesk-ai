const fs = require('fs');
const path = require('path');

function walk(dir, filelist = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const dirFile = path.join(dir, file);
        if (fs.statSync(dirFile).isDirectory()) {
            if (!dirFile.includes('node_modules') && !dirFile.includes('.git') && !dirFile.includes('dist')) {
                walk(dirFile, filelist);
            }
        } else {
            if (['.ts', '.tsx', '.js', '.jsx'].some(ext => dirFile.endsWith(ext))) {
                filelist.push(dirFile);
            }
        }
    }
    return filelist;
}

const files = walk('.');
let totalLines = 0;
let anyCount = 0;
let consoleCount = 0;
let fileStats = [];

for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    totalLines += lines.length;

    let fAnyCount = 0;
    let fConsoleCount = 0;

    for (let l of lines) {
        if (l.includes(': any ') || l.includes(': any;') || l.includes(': any,') || l.includes(': any)') || l.includes(' as any')) {
            fAnyCount++;
        }
        if (l.includes('console.log')) {
            fConsoleCount++;
        }
    }

    anyCount += fAnyCount;
    consoleCount += fConsoleCount;

    fileStats.push({ file: f, lines: lines.length, anyMatches: fAnyCount, consoleMatches: fConsoleCount });
}

fileStats.sort((a, b) => b.lines - a.lines);

console.log('--- STATS ---');
console.log('Total JS/TS Files:', files.length);
console.log('Total Lines of Code:', totalLines);
console.log('Total `any` occurrences:', anyCount);
console.log('Total console.log occurrences:', consoleCount);
console.log('\nTop 15 Largest Files:');
fileStats.slice(0, 15).forEach(stat => console.log(`${stat.file}: ${stat.lines} lines (any: ${stat.anyMatches}, console.log: ${stat.consoleMatches})`));
console.log('\nFiles over 500 lines:', fileStats.filter(f => f.lines > 500).length);
console.log('Files over 1000 lines:', fileStats.filter(f => f.lines > 1000).length);
