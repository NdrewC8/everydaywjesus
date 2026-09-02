import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { loadPublishedSnapshot } from './lib/content';
import { safeContentUrl, safeExternalUrl, youtubeThumbnail } from './lib/url';
import type { NoticeItem, PublishedSnapshot, ResourceItem, SectionId } from './types';

const sections: Array<{ id: SectionId; label: string; icon: string }> = [
  { id: 'notices', label: '공지', icon: '소식' },
  { id: 'sermon', label: '설교', icon: '말씀' },
  { id: 'books', label: '추천 도서', icon: '도서' },
  { id: 'healing', label: '치유', icon: '회복' },
  { id: 'prayer', label: '기도', icon: '기도' },
  { id: 'praise', label: '찬양', icon: '찬양' },
  { id: 'bible', label: '성경', icon: '성경' },
  { id: 'churches', label: '지교회', icon: '교회' },
  { id: 'links', label: '바로가기', icon: '링크' },
  { id: 'truth', label: '진실의 방', icon: '영상' }
];

const AdminApp = lazy(() => import('./admin/AdminApp'));

export default function App() {
  if (window.location.pathname.startsWith('/admin')) {
    return <Suspense fallback={<div className="boot-fallback">관리자 화면을 불러오는 중입니다…</div>}><AdminApp /></Suspense>;
  }
  return <PublicApp />;
}

function initialSection(): SectionId {
  const requested = new URLSearchParams(window.location.search).get('section');
  return sections.some(({ id }) => id === requested) ? (requested as SectionId) : 'notices';
}

function ResourceCard({ item }: { item: ResourceItem }) {
  const url = safeExternalUrl(item.url);
  const thumbnail = safeContentUrl(item.thumbnailUrl) ?? youtubeThumbnail(item.url);
  return (
    <article className="resource-card">
      {thumbnail ? <img src={thumbnail} alt="" loading="lazy" width="480" height="270" /> : <div className="card-mark">{item.label ?? '콘텐츠'}</div>}
      <div className="card-copy">
        {item.label && <span className="eyebrow">{item.label}</span>}
        <h3>{item.title}</h3>
        {item.subtitle && <p>{item.subtitle}</p>}
        {url ? <a href={url} target="_blank" rel="noopener noreferrer">열어보기 <span aria-hidden="true">↗</span></a> : <span className="unavailable">현재 이용할 수 없습니다</span>}
      </div>
    </article>
  );
}

function NoticeCard({ item }: { item: NoticeItem }) {
  const [open, setOpen] = useState(false);
  const linkUrl = safeExternalUrl(item.linkUrl);
  return (
    <article className={`notice-card${open ? ' is-open' : ''}`}>
      <button className="notice-heading" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span><small>{item.date || '공지사항'}</small>{item.title}</span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="notice-body">
          {item.body && <p>{item.body}</p>}
          {item.imageUrls?.map((src) => {
            const safeSrc = safeContentUrl(src);
            return safeSrc ? <img key={safeSrc} src={safeSrc} alt="공지 이미지" loading="lazy" /> : null;
          })}
          {linkUrl && <a href={linkUrl} target="_blank" rel="noopener noreferrer">{item.linkText || '자세히 보기'} ↗</a>}
        </div>
      )}
    </article>
  );
}

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function HeaderActions() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const appInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', appInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', appInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) { window.location.assign('/guide.html'); return; }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
  }

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: '매일 예수님과 함께', text: '말씀과 기도, 찬양을 함께 나눠요.', url: window.location.origin });
      else { await navigator.clipboard.writeText(window.location.origin); setStatus('주소를 복사했습니다.'); }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setStatus('공유하지 못했습니다. 주소를 직접 복사해 주세요.');
    }
  }

  return <div className="header-actions">
    <a href="/guide.html">사용 안내</a>
    {!installed && <button type="button" onClick={install}>{installPrompt ? '앱 설치' : '설치 안내'}</button>}
    <button type="button" onClick={share}>공유</button>
    {status && <span role="status" className="sr-only">{status}</span>}
  </div>;
}

function PublicApp() {
  const [active, setActive] = useState<SectionId>(initialSection);
  const [snapshot, setSnapshot] = useState<PublishedSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    loadPublishedSnapshot().then((value) => alive && setSnapshot(value));
    const updateHandler = () => setUpdateAvailable(true);
    window.addEventListener('ewj:update-available', updateHandler);
    return () => {
      alive = false;
      window.removeEventListener('ewj:update-available', updateHandler);
    };
  }, []);

  const resources = useMemo(
    () => snapshot?.resources.filter((item) => item.section === active).sort((a, b) => a.order - b.order) ?? [],
    [active, snapshot]
  );
  const churches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ko-KR');
    const items = snapshot?.churches ?? [];
    return needle ? items.filter((item) => `${item.name} ${item.region} ${item.address ?? ''}`.toLocaleLowerCase('ko-KR').includes(needle)) : items;
  }, [query, snapshot]);

  function changeSection(id: SectionId) {
    setActive(id);
    setQuery('');
    const url = new URL(window.location.href);
    if (id === 'notices') url.searchParams.delete('section');
    else url.searchParams.set('section', id);
    window.history.replaceState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const current = sections.find(({ id }) => id === active) ?? sections[0]!;

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="매일 예수님과 함께 홈">
            <img src="/logo.png" alt="" width="52" height="52" />
            <span><small>EVERYDAY WITH JESUS</small>매일 예수님과 함께</span>
          </a>
          <HeaderActions />
        </div>
      </header>

      <nav className="section-nav" aria-label="주요 메뉴">
        <div className="nav-inner">
          {sections.map((section) => (
            <button key={section.id} type="button" className={active === section.id ? 'active' : ''} onClick={() => changeSection(section.id)}>
              <span>{section.icon}</span>{section.label}
            </button>
          ))}
        </div>
      </nav>

      <main>
        <div className="section-heading">
          <span>{current.icon}</span>
          <div><small>EVERYDAY WITH JESUS</small><h1>{current.label}</h1></div>
        </div>

        {!snapshot ? (
          <div className="loading-card" role="status"><span />콘텐츠를 불러오는 중입니다.</div>
        ) : active === 'notices' ? (
          snapshot.notices.length > 0 ? <div className="notice-list">{[...snapshot.notices].sort((a, b) => b.order - a.order).map((item) => <NoticeCard key={item.id} item={item} />)}</div> : <div className="empty-card">등록된 공지사항이 없습니다.</div>
        ) : active === 'churches' ? (
          <section>
            <label className="search"><span className="sr-only">지교회 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="지역명, 교회명 또는 주소 검색" type="search" /></label>
            {churches.length > 0 ? <div className="church-grid">{churches.map((church) => {
              const churchUrl = safeExternalUrl(church.url);
              return <article className="church-card" key={church.id}><small>{church.region}</small><h3>{church.name}</h3>{church.address && <p>{church.address}</p>}{churchUrl && <a href={churchUrl} target="_blank" rel="noopener noreferrer">홈페이지 ↗</a>}</article>;
            })}</div> : <div className="empty-card">검색 결과가 없습니다.</div>}
          </section>
        ) : resources.length > 0 ? (
          <div className="resource-grid">{resources.map((item) => <ResourceCard key={item.id} item={item} />)}</div>
        ) : (
          <div className="empty-card">콘텐츠를 준비하고 있습니다.</div>
        )}

        {active === 'notices' && snapshot && <QuickActions snapshot={snapshot} />}
      </main>

      <footer><span>© {new Date().getFullYear()} Everyday with Jesus</span><a href="/admin/">관리자</a></footer>
      {updateAvailable && <div className="update-toast" role="status">새 버전이 준비됐습니다.<button type="button" onClick={() => window.location.reload()}>새로고침</button></div>}
    </div>
  );
}

function QuickActions({ snapshot }: { snapshot: PublishedSnapshot }) {
  const supportUrl = safeExternalUrl(snapshot.settings.supportUrl);
  const inquiryUrl = safeExternalUrl(snapshot.settings.inquiryUrl);
  if (!supportUrl && !inquiryUrl) return null;
  return <div className="quick-actions">
    {supportUrl && <a className="support" href={supportUrl} target="_blank" rel="noopener noreferrer">선교 후원하기 ↗</a>}
    {inquiryUrl && <a className="inquiry" href={inquiryUrl} target="_blank" rel="noopener noreferrer">카카오톡으로 문의하기 ↗</a>}
  </div>;
}
