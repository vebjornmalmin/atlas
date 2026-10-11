import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';

export default defineConfig({
  plugins: [sveltekit({
    adapter: adapter({pages: 'build', assets: 'build', fallback: 'index.html'}),
    files: { assets: 'public' },
    serviceWorker: { register: false },
    csp: { mode: 'hash', directives: { 'script-src': ['self'], 'style-src': ['self', 'unsafe-inline'], 'object-src': ['none'], 'base-uri': ['self'] } }
  })]
});
