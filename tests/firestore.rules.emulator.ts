import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'demo-everydaywjesus',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'published', 'current'), validSnapshot());
  });
});

afterAll(async () => environment.cleanup());

describe('Firestore security rules', () => {
  it('lets the public read only the current published snapshot', async () => {
    const database = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(database, 'published', 'current')));
    await assertFails(getDoc(doc(database, 'resources', 'private-item')));
  });

  it('blocks anonymous and ordinary authenticated writes', async () => {
    await assertFails(setDoc(doc(environment.unauthenticatedContext().firestore(), 'resources', 'x'), { title: 'x' }));
    await assertFails(setDoc(doc(environment.authenticatedContext('member').firestore(), 'resources', 'x'), { title: 'x' }));
  });

  it('allows an admin to edit normalized content', async () => {
    const database = environment.authenticatedContext('admin-uid', { admin: true }).firestore();
    await assertSucceeds(setDoc(doc(database, 'resources', 'x'), { section: 'sermon', title: '안전한 콘텐츠', url: 'https://example.com', order: 0 }));
    await assertFails(setDoc(doc(database, 'resources', 'unsafe'), { section: 'sermon', title: '안전하지 않은 링크', url: 'http://example.com', order: 1 }));
  });

  it('accepts only the v2 shape when publishing', async () => {
    const database = environment.authenticatedContext('admin-uid', { admin: true }).firestore();
    await assertSucceeds(setDoc(doc(database, 'published', 'current'), validSnapshot()));
    await assertFails(setDoc(doc(database, 'published', 'current'), { schemaVersion: 1 }));
    await assertFails(setDoc(doc(database, 'published', 'preview'), validSnapshot()));
  });
});

function validSnapshot() {
  return { schemaVersion: 2, publishedAt: new Date().toISOString(), notices: [], resources: [], churches: [], settings: { siteName: '매일 예수님과 함께' } };
}
