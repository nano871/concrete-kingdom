import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: {
      key: fs.readFileSync('/root/concrete-kingdom/key.pem'),
      cert: fs.readFileSync('/root/concrete-kingdom/cert.pem'),
    },
  },
});
