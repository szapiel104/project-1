import { defineConfig } from 'vitest/config';

/** Długie gry bot kontra bot (przegląd błędów): npx vitest run --config tools/soak/vitest.config.ts */
export default defineConfig({ test: { include: ['tools/soak/**/*.soak.ts'], testTimeout: 3_600_000 } });
