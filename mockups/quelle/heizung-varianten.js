// Baut mockups/heizung-varianten.html: node mockups/quelle/heizung-varianten.js
// Grundlage ist glas.html (wird dafür neu gebaut); nur der Reiter Heizung wird durch drei Varianten ersetzt.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const repo = path.join(__dirname, '..', '..');
execFileSync(process.execPath, [path.join(__dirname, 'glas.js')], { stdio: 'inherit' });
let html = fs.readFileSync(path.join(repo, 'mockups', 'glas.html'), 'utf8');
const ersetze = (a, b) => { if (!html.includes(a)) throw new Error('nicht gefunden: ' + a); html = html.replace(a, b); };
ersetze('<title>Baustelle – Glas, klickbar</title>', '<title>Baustelle – Heizung, drei Varianten</title>');
ersetze('<b>Baustelle · Glas · klickbarer Prototyp</b>', `<b>Reiter Heizung · Varianten</b>
<label>Variante <select id="hz-variante"><option value="A">A · Kacheln</option><option value="B">B · Heute + aufklappbar</option><option value="C">C · Jetzt / Plan / Regeln</option></select></label>`);
ersetze('</style></head>', fs.readFileSync(path.join(__dirname, 'heizung-varianten.css'), 'utf8') + '</style></head>');
const i = html.lastIndexOf('</script></body>');
html = html.slice(0, i) + '\n' + fs.readFileSync(path.join(__dirname, 'heizung-varianten-app.js'), 'utf8') + html.slice(i);
const ziel = path.join(repo, 'mockups', 'heizung-varianten.html');
fs.writeFileSync(ziel, html);
console.log('geschrieben', path.relative(repo, ziel), Math.round(html.length / 1024), 'KB');
