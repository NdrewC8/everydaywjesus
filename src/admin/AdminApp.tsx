import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { getFirebaseApp, hasFirebaseConfig } from '../lib/firebase';
import { safeContentUrl, safeExternalUrl } from '../lib/url';
import type { ChurchItem, NoticeItem, ResourceItem, SectionId } from '../types';
import { optimizeImage } from './image';
import './admin.css';

type EditorKind = 'resources' | 'notices' | 'churches';
type Editable = ResourceItem | NoticeItem | ChurchItem;

const resourceSections: Array<{ id: ResourceItem['section']; label: string }> = [
  { id: 'sermon', label: '설교' }, { id: 'books', label: '추천 도서' }, { id: 'healing', label: '치유' },
  { id: 'prayer', label: '기도' }, { id: 'praise', label: '찬양' }, { id: 'bible', label: '성경' },
  { id: 'links', label: '바로가기' }, { id: 'truth', label: '진실의 방' }
];

export default function AdminApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!hasFirebaseConfig()) { setAuthorized(false); return; }
    let unsubscribe = () => {};
    getFirebaseApp().then(async (app) => {
      if (!app) return;
      const { getAuth, onAuthStateChanged } = await import('firebase/auth');
      unsubscribe = onAuthStateChanged(getAuth(app), async (nextUser) => {
        setUser(nextUser);
        if (!nextUser) { setAuthorized(false); return; }
        const token = await nextUser.getIdTokenResult(true);
        const allowed = token.claims.admin === true;
        setAuthorized(allowed);
        if (!allowed) setMessage('이 계정에는 관리자 권한이 없습니다.');
      });
    }).catch(() => setMessage('Firebase 연결을 초기화하지 못했습니다.'));
    return () => unsubscribe();
  }, []);

  if (!hasFirebaseConfig()) return <AdminMessage title="관리자 환경 설정 필요" body="스테이징 Firebase 환경 변수를 연결한 뒤 사용할 수 있습니다." />;
  if (authorized === null) return <div className="admin-loading">권한을 확인하는 중입니다…</div>;
  if (!user || !authorized) return <Login message={message} />;
  return <Dashboard user={user} />;
}

function AdminMessage({ title, body }: { title: string; body: string }) {
  return <main className="admin-message"><img src="/logo.png" alt="" width="64" height="64" /><h1>{title}</h1><p>{body}</p><a href="/">회원 화면으로 돌아가기</a></main>;
}

function Login({ message }: { message: string }) {
  const [error, setError] = useState(message);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const app = await getFirebaseApp();
      if (!app) throw new Error('Firebase 설정이 없습니다.');
      const { getAuth, signInWithEmailAndPassword, signOut } = await import('firebase/auth');
      const credential = await signInWithEmailAndPassword(getAuth(app), String(data.get('email')), String(data.get('password')));
      const token = await credential.user.getIdTokenResult(true);
      if (token.claims.admin !== true) { await signOut(getAuth(app)); throw new Error('관리자 권한이 없는 계정입니다.'); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '로그인하지 못했습니다.'); setBusy(false);
    }
  }
  return <main className="login-shell"><form onSubmit={submit}><img src="/logo.png" alt="" width="64" height="64" /><small>EVERYDAY WITH JESUS</small><h1>관리자 로그인</h1><label>이메일<input name="email" type="email" autoComplete="username" required /></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button disabled={busy} type="submit">{busy ? '확인 중…' : '로그인'}</button><a href="/">회원 화면으로 돌아가기</a></form></main>;
}

function Dashboard({ user }: { user: User }) {
  const [kind, setKind] = useState<EditorKind>('resources');
  const [items, setItems] = useState<Editable[]>([]);
  const [resourceSection, setResourceSection] = useState<ResourceItem['section']>('sermon');
  const [editing, setEditing] = useState<Partial<Editable> | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  async function database() {
    const app = await getFirebaseApp();
    if (!app) throw new Error('Firebase 설정이 없습니다.');
    const { getFirestore } = await import('firebase/firestore');
    return getFirestore(app);
  }

  async function load(nextKind = kind) {
    setBusy(true); setStatus('');
    try {
      const db = await database();
      const { collection, getDocs } = await import('firebase/firestore');
      const response = await getDocs(collection(db, nextKind));
      const values = response.docs.map((entry) => ({ id: entry.id, ...entry.data() } as Editable));
      values.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
      setItems(values);
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : '목록을 불러오지 못했습니다.'); }
    finally { setBusy(false); }
  }

  useEffect(() => { void load(kind); }, [kind]);

  const visible = useMemo(() => kind === 'resources' ? (items as ResourceItem[]).filter((item) => item.section === resourceSection) : items, [items, kind, resourceSection]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus('');
    try {
      const form = event.currentTarget;
      const data = new FormData(form);
      const db = await database();
      const { addDoc, collection, doc, setDoc } = await import('firebase/firestore');
      const id = typeof editing?.id === 'string' ? editing.id : null;
      let value: Record<string, unknown>;
      if (kind === 'resources') value = { section: data.get('section'), title: data.get('title'), subtitle: data.get('subtitle'), url: data.get('url'), thumbnailUrl: data.get('thumbnailUrl'), label: data.get('label'), order: Number(data.get('order') || 0) };
      else if (kind === 'notices') value = { title: data.get('title'), body: data.get('body'), date: data.get('date'), imageUrls: String(data.get('imageUrls') || '').split('\n').map((item) => item.trim()).filter(Boolean), linkUrl: data.get('linkUrl'), linkText: data.get('linkText'), order: Number(data.get('order') || 0) };
      else value = { name: data.get('name'), region: data.get('region'), address: data.get('address'), phone: data.get('phone'), url: data.get('url'), order: Number(data.get('order') || 0) };
      const clean = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== '' && item !== null));
      if (id) await setDoc(doc(db, kind, id), clean, { merge: false }); else await addDoc(collection(db, kind), clean);
      setEditing(null); setStatus('저장했습니다. 아직 회원 화면에는 발행되지 않았습니다.'); await load();
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : '저장하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  async function remove(item: Editable) {
    if (!window.confirm(`“${itemTitle(item)}” 항목을 삭제할까요?`)) return;
    setBusy(true);
    try {
      const db = await database(); const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, kind, item.id)); setEditing(null); setStatus('삭제했습니다. 아직 회원 화면에는 발행되지 않았습니다.'); await load();
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : '삭제하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  async function publish() {
    if (!window.confirm('현재 관리자 데이터를 회원 화면에 발행할까요?')) return;
    setBusy(true); setStatus('발행 데이터를 만드는 중입니다…');
    try {
      const db = await database();
      const { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } = await import('firebase/firestore');
      const [resources, notices, churches, settingsDoc] = await Promise.all([
        getDocs(collection(db, 'resources')), getDocs(collection(db, 'notices')), getDocs(collection(db, 'churches')), getDoc(doc(db, 'siteSettings', 'main'))
      ]);
      const byOrder = (a: { order?: number }, b: { order?: number }) => Number(a.order ?? 0) - Number(b.order ?? 0);
      const snapshot = {
        schemaVersion: 2,
        publishedAt: new Date().toISOString(),
        resources: resources.docs.map((item) => ({ id: item.id, ...item.data() } as ResourceItem)).sort(byOrder),
        notices: notices.docs.map((item) => ({ id: item.id, ...item.data() } as NoticeItem)).sort(byOrder),
        churches: churches.docs.map((item) => ({ id: item.id, ...item.data() } as ChurchItem)).sort(byOrder),
        settings: settingsDoc.exists() ? settingsDoc.data() : { siteName: '매일 예수님과 함께' }
      };
      await setDoc(doc(db, 'published', 'current'), snapshot);
      await addAuditLog(db, user.uid, 'publish', { counts: { resources: snapshot.resources.length, notices: snapshot.notices.length, churches: snapshot.churches.length }, createdAt: serverTimestamp() });
      setStatus('회원 화면에 발행했습니다.');
    } catch (reason) { setStatus(reason instanceof Error ? reason.message : '발행하지 못했습니다.'); }
    finally { setBusy(false); }
  }

  async function signOutAdmin() {
    const app = await getFirebaseApp(); if (!app) return;
    const { getAuth, signOut } = await import('firebase/auth'); await signOut(getAuth(app));
  }

  return <div className="admin-shell">
    <header className="admin-header"><a href="/"><img src="/logo.png" alt="" width="42" height="42" />관리자</a><div><button type="button" className="publish" onClick={publish} disabled={busy}>회원 화면에 발행</button><button type="button" onClick={signOutAdmin}>로그아웃</button></div></header>
    <nav className="admin-tabs">{(['resources', 'notices', 'churches'] as EditorKind[]).map((id) => <button className={kind === id ? 'active' : ''} key={id} onClick={() => { setKind(id); setEditing(null); }}>{id === 'resources' ? '콘텐츠' : id === 'notices' ? '공지' : '지교회'}</button>)}</nav>
    <main className="admin-main">
      <div className="admin-toolbar"><div>{kind === 'resources' && <select value={resourceSection} onChange={(event) => setResourceSection(event.target.value as ResourceItem['section'])}>{resourceSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select>}<strong>{visible.length}개 항목</strong></div><button type="button" onClick={() => setEditing(newItem(kind, resourceSection, visible.length))}>+ 새 항목</button></div>
      {status && <p className="admin-status" role="status">{status}</p>}
      <div className="admin-workspace"><section className="admin-list">{busy && items.length === 0 ? <p>불러오는 중…</p> : visible.map((item) => <button type="button" key={item.id} onClick={() => setEditing(item)}><span>{itemTitle(item)}</span><small>순서 {item.order ?? 0}</small></button>)}</section>{editing && <Editor kind={kind} value={editing} busy={busy} onSubmit={save} onDelete={'id' in editing && editing.id ? () => remove(editing as Editable) : undefined} onCancel={() => setEditing(null)} onUploaded={(url, thumbnail) => setEditing((current) => current ? ({ ...current, ...(kind === 'notices' ? { imageUrls: [...(('imageUrls' in current && Array.isArray(current.imageUrls)) ? current.imageUrls : []), url] } : { thumbnailUrl: thumbnail ?? url }) } as Partial<Editable>) : current)} />}</div>
    </main>
  </div>;
}

async function addAuditLog(db: import('firebase/firestore').Firestore, actorUid: string, action: string, details: Record<string, unknown>) {
  const { addDoc, collection } = await import('firebase/firestore');
  await addDoc(collection(db, 'auditLogs'), { actorUid, action, ...details });
}

function itemTitle(item: Partial<Editable>) {
  if ('title' in item) return String(item.title ?? '제목 없음');
  if ('name' in item) return String(item.name ?? '이름 없음');
  return '이름 없음';
}
function newItem(kind: EditorKind, section: ResourceItem['section'], order: number): Partial<Editable> {
  if (kind === 'resources') return { section, title: '', url: '', order };
  if (kind === 'notices') return { title: '', date: new Date().toISOString().slice(0, 10), imageUrls: [], order };
  return { name: '', region: '', order };
}

function Editor({ kind, value, busy, onSubmit, onDelete, onCancel, onUploaded }: { kind: EditorKind; value: Partial<Editable>; busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onDelete?: () => void; onCancel: () => void; onUploaded: (url: string, thumbnail?: string) => void }) {
  return <form className="admin-editor" onSubmit={onSubmit}><h2>{'id' in value && value.id ? '항목 수정' : '새 항목'}</h2>
    {kind === 'resources' && <><label>분류<select name="section" defaultValue={(value as Partial<ResourceItem>).section}>{resourceSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}</select></label><Field name="title" label="제목" value={(value as Partial<ResourceItem>).title} required /><Field name="subtitle" label="설명" value={(value as Partial<ResourceItem>).subtitle} /><Field name="url" label="연결 주소 (https)" value={(value as Partial<ResourceItem>).url} type="url" required /><Field name="label" label="라벨" value={(value as Partial<ResourceItem>).label} /><Field name="thumbnailUrl" label="썸네일 주소" value={(value as Partial<ResourceItem>).thumbnailUrl} /><ImageUpload onUploaded={onUploaded} /></>}
    {kind === 'notices' && <><Field name="title" label="제목" value={(value as Partial<NoticeItem>).title} required /><label>내용<textarea name="body" defaultValue={(value as Partial<NoticeItem>).body ?? ''} rows={7} /></label><Field name="date" label="날짜" value={(value as Partial<NoticeItem>).date} type="date" /><label>이미지 주소 (한 줄에 하나)<textarea key={((value as Partial<NoticeItem>).imageUrls ?? []).join('\n')} name="imageUrls" defaultValue={((value as Partial<NoticeItem>).imageUrls ?? []).join('\n')} rows={4} /></label><ImageUpload onUploaded={onUploaded} /><Field name="linkUrl" label="연결 주소" value={(value as Partial<NoticeItem>).linkUrl} type="url" /><Field name="linkText" label="버튼 문구" value={(value as Partial<NoticeItem>).linkText} /></>}
    {kind === 'churches' && <><Field name="name" label="교회명" value={(value as Partial<ChurchItem>).name} required /><Field name="region" label="지역" value={(value as Partial<ChurchItem>).region} required /><Field name="address" label="주소" value={(value as Partial<ChurchItem>).address} /><Field name="phone" label="전화번호" value={(value as Partial<ChurchItem>).phone} /><Field name="url" label="지도·홈페이지 주소" value={(value as Partial<ChurchItem>).url} type="url" /></>}
    <Field name="order" label="표시 순서" value={value.order} type="number" required />
    <div className="editor-actions">{onDelete && <button className="danger" type="button" onClick={onDelete}>삭제</button>}<span /><button type="button" onClick={onCancel}>취소</button><button className="primary" disabled={busy} type="submit">저장</button></div>
  </form>;
}

function Field({ name, label, value, type = 'text', required = false }: { name: string; label: string; value: unknown; type?: string; required?: boolean }) {
  return <label>{label}<input name={name} type={type} defaultValue={String(value ?? '')} required={required} /></label>;
}

function ImageUpload({ onUploaded }: { onUploaded: (url: string, thumbnail?: string) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function upload(file?: File) {
    if (!file) return; setBusy(true); setError('');
    try {
      const optimized = await optimizeImage(file); const app = await getFirebaseApp(); if (!app) throw new Error('Firebase 설정이 없습니다.');
      const { getStorage, getDownloadURL, ref, uploadBytes } = await import('firebase/storage');
      const storage = getStorage(app); const id = crypto.randomUUID();
      const originalRef = ref(storage, `content/${id}/original.${optimized.extension}`); const thumbRef = ref(storage, `content/${id}/thumb.${optimized.extension}`);
      const metadata = { contentType: optimized.original.type, cacheControl: 'public,max-age=31536000,immutable' };
      await Promise.all([uploadBytes(originalRef, optimized.original, metadata), uploadBytes(thumbRef, optimized.thumbnail, { ...metadata, contentType: optimized.thumbnail.type })]);
      onUploaded(await getDownloadURL(originalRef), await getDownloadURL(thumbRef));
    } catch (reason) { setError(reason instanceof Error ? reason.message : '업로드하지 못했습니다.'); }
    finally { setBusy(false); }
  }
  return <label className="upload-label">최적화 이미지 업로드<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event.target.files?.[0])} disabled={busy} />{busy && <small>변환하고 올리는 중…</small>}{error && <small className="form-error">{error}</small>}</label>;
}
