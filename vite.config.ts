import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');
  const disableHmr = env.DISABLE_HMR === 'true' || process.env.DISABLE_HMR === 'true';

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    server: {
      port: 3000,
      hmr: disableHmr ? false : undefined,
      watch: disableHmr ? null : undefined,
    },
    define: {
      // Polyfill process.env for libraries or legacy code that expects it.
      // Stringify the env object to ensure it is injected as a value, not a reference.
      'process.env': JSON.stringify(env)
    }
  };
});
