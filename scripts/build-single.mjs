// Builds a single self-contained HTML file (all CSS + JS inlined) for quick testing on a phone.
// Usage: node scripts/build-single.mjs   (needs esbuild: npm i --no-save esbuild)
//   dist/republic-rising-standalone.html  – full HTML document, open directly in any browser
//   dist/republic-rising-fragment.html    – same page without <html>/<head>/<body>, for hosted previews
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const res = await build({
  entryPoints: [root + 'js/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  target: 'es2020',
  write: false,
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync(root + 'css/style.css', 'utf8');
const html = readFileSync(root + 'index.html', 'utf8');
const body = html
  .slice(html.indexOf('<body>') + 6, html.indexOf('</body>'))
  .replace(/<script type="module"[^>]*><\/script>/, '')
  .trim();
const title = /<title>(.*?)<\/title>/.exec(html)[1];
const noSdk = process.argv.includes('--no-sdk');
const scripts = `${noSdk ? '<script>window.RR_NO_SDK = true;</script>\n' : ''}<script>${js}</script>`;

const fragment = `<title>${title}</title>\n<style>${css}</style>\n${body}\n${scripts}\n`;
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>${title}</title>
<style>${css}</style>
</head>
<body>
${body}
${scripts}
</body>
</html>
`;
mkdirSync(root + 'dist', { recursive: true });
writeFileSync(root + 'dist/republic-rising-standalone.html', standalone);
writeFileSync(root + 'dist/republic-rising-fragment.html', fragment);
console.log(`standalone ${(standalone.length / 1024).toFixed(0)} KB, fragment ${(fragment.length / 1024).toFixed(0)} KB`);
