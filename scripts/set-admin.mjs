import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [email, confirmation] = process.argv.slice(2);
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!email || confirmation !== '--confirm') {
  console.error('사용법: FIREBASE_PROJECT_ID=프로젝트ID GOOGLE_APPLICATION_CREDENTIALS=서비스계정.json node scripts/set-admin.mjs 이메일 --confirm');
  process.exit(1);
}
if (!projectId) throw new Error('FIREBASE_PROJECT_ID가 필요합니다.');

initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, admin: true });
await auth.revokeRefreshTokens(user.uid);
console.log(`관리자 권한을 부여했습니다: ${email} (${user.uid})`);
