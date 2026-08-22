const fs = require('fs');
const path = require('path');

const distDirectory = path.join(__dirname, '..', 'dist');
const projectDirectory = path.join(__dirname, '..');
const fileExtensions = new Set(['.css', '.html', '.js', '.json']);
const basePath = (process.env.BASE_PATH || '/').replace(/\/+$/, '') || '/';

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
const serviceWorker = fs.readFileSync(path.join(projectDirectory, 'public', 'sw.js'), 'utf8')
  .replaceAll('__APP_BASE_PATH__', `${basePath === '/' ? '' : basePath}/`);
fs.writeFileSync(path.join(distDirectory, 'sw.js'), serviceWorker);
console.log('Normalized root-relative web asset URLs.');
