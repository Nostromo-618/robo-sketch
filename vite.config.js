import { defineConfig } from 'vite';

const REPO_NAME = 'robo-sketch';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO_NAME}/` : '/',
  server: {
    port: 3000,
    open: true
  },
  assetsInclude: ['**/*.glb', '**/*.gltf']
}));