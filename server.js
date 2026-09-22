import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

app.disable('x-powered-by');

// 最低限のセキュリティヘッダー
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 公開してよいものだけを配信する。
// 以前は express.static(__dirname) でプロジェクト直下を丸ごと公開していたため、
// server.js / package.json / .env.example / .replit などのソースや設定ファイルまで
// URL で取得できてしまっていた。
app.use(express.static(path.join(__dirname, 'public')));
app.use('/src', express.static(path.join(__dirname, 'src'), { index: false, dotfiles: 'deny' }));

const ROOT_FILES = ['icon.svg', 'apple-icon.png', 'icon-dark-32x32.png', 'icon-light-32x32.png'];
for (const name of ROOT_FILES) {
  app.get('/' + name, (req, res, next) => {
    res.sendFile(path.join(__dirname, name), (err) => { if (err) next(); });
  });
}

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 拡張子付きのパス（存在しない .js / .png など）は index.html を返さず 404 にする
// （JS の代わりに HTML が返ると「MIME type」エラーで原因が分かりにくくなるため）
app.use((req, res) => {
  if (path.extname(req.path)) {
    return res.status(404).type('text/plain').send('Not Found');
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 想定外のエラーでプロセスが落ちないようにする
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (res.headersSent) return next(err);
  res.status(500).type('text/plain').send('Internal Server Error');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
