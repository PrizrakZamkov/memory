export default {
  root: '.',
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true
      }
    }
  }
};
