# Everyday with Jesus V2

운영 사이트를 중단하지 않고 교체하기 위한 V2입니다.

- 운영: <https://www.everydaywjesus.com> — GitHub `main`, 현재 그대로 유지
- 스테이징: <https://everydaywjesus-staging.web.app> — Firebase Hosting
- 개발 브랜치: `v2`

## 현재 상태

- React + TypeScript + Vite 기반 반응형 회원 화면
- 같은 도메인 루트 PWA identity 유지
- 공지 4건, 콘텐츠 39건, 지교회 34곳을 V2 스냅샷으로 이관
- Base64 이미지를 WebP 파일로 분리하고 EXIF 제거
- 관리자 custom claim 확인, Firestore/Storage 규칙, 감사 로그 구조
- GitHub Actions 타입 검사·테스트·production build

스테이징 Firestore는 규칙 검증용이며 현재 `nam5`에 있습니다. 실제 운영 프로젝트의 기본 Firestore는 데이터를 넣기 전에 `asia-northeast3`로 생성해야 합니다.

## 로컬 실행

```bash
npm install
npm run dev
npm run check
npm run build
```

`.env.example`을 참고해 환경별 `.env.local`을 만들며, 이 파일은 커밋하지 않습니다.

## 운영 전 필수 게이트

1. Galaxy Samsung Internet/Chrome, iOS Safari/PWA, Windows/macOS 데스크톱 QA
2. Firebase Authentication 이메일 로그인을 켜고 관리자 custom claim 지정
3. Storage를 쓸 경우 Blaze 결제 연결 및 예산 알림 설정 후 이미지 업로드 활성화
4. 스테이징 데이터 발행과 관리자 편집 테스트
5. 운영 Firebase 프로젝트를 서울 리전으로 생성하고 최종 데이터 동기화
6. 기존 설치 PWA 업데이트 검증 후 `www.everydaywjesus.com` 전환
