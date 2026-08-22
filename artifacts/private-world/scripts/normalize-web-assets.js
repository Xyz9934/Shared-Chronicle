const fs = require('fs');
const path = require('path');

const distDirectory = path.join(__dirname, '..', 'dist');
const fileExtensions = new Set(['.css', '.html', '.js', '.json']);

function normalizeFile(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  const normalized = contents.replace(/(?<!:)\/\/assets\//g, '/assets/');

  if (normalized !== contents) {
    fs.writeFileSync(filePath, normalized);
  }
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath);
    } else if (fileExtensions.has(path.extname(entry.name))) {
      normalizeFile(entryPath);
    }
  }
}

if (!fs.existsSync(distDirectory)) {
  throw new Error(`Web export directory not found: ${distDirectory}`);
}

walk(distDirectory);
console.log('Normalized root-relative web asset URLs.');
