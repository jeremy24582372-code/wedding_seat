import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const projectRoot = 'D:/Wedding/排座位';
const require = createRequire(`${projectRoot}/package.json`);
const { defineConfig } = await import(pathToFileURL(require.resolve('vite')).href);
const react = (await import(pathToFileURL(require.resolve('@vitejs/plugin-react')).href)).default;

export default defineConfig({
  root: projectRoot,
  envDir: `${projectRoot}/.tmp/wedding-vite-hover-env`,
  cacheDir: `${projectRoot}/.tmp/vite-hover-cache`,
  plugins: [react()],
  base: '/wedding_seat/',
});
