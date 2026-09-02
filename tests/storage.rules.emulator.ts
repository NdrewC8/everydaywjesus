import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, uploadBytes } from 'firebase/storage';

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-everydaywjesus',
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 }
  });
});

afterAll(async () => environment.cleanup());

describe('Storage security rules', () => {
  const image = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);

  it('blocks public and ordinary-member uploads', async () => {
    await assertFails(uploadBytes(ref(environment.unauthenticatedContext().storage(), 'content/a/test.jpg'), image, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(environment.authenticatedContext('member').storage(), 'content/a/test.jpg'), image, { contentType: 'image/jpeg' }));
  });

  it('allows admin images but blocks executable content', async () => {
    const storage = environment.authenticatedContext('admin-uid', { admin: true }).storage();
    await assertSucceeds(uploadBytes(ref(storage, 'content/a/test.jpg'), image, { contentType: 'image/jpeg' }));
    await assertFails(uploadBytes(ref(storage, 'content/a/test.html'), new TextEncoder().encode('<script></script>'), { contentType: 'text/html' }));
  });
});
