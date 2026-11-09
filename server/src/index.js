import { buildApp } from './app.js';
import { config } from './config.js';
const app = buildApp({ logger: { level: process.env.LOG_LEVEL || 'info' } });
app.listen({ port: config.port, host: config.host }).then(() => {
  app.log.info({ port: config.port, host: config.host, data: config.dataDir, ai: (await import('./ai/index.js')).chainLabel(), secureCookies: config.secureCookies }, 'Cyber Investigation Board server up');
}).catch(e => { console.error(e); process.exit(1); });
