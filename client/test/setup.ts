import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// `globals: false` in vite.config.ts means RTL's automatic afterEach-cleanup
// detection doesn't kick in on its own — wire it up explicitly instead.
afterEach(() => {
  cleanup();
});
