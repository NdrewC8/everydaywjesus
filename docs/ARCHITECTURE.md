# Everyday with Jesus V2

## 운영 원칙

- 현재 운영 `main`과 V2 개발을 분리한다.
- 스테이징에서 기기 검증을 마치기 전에는 운영 도메인을 바꾸지 않는다.
- PWA `id`, `start_url`, `scope`는 모두 `/`로 유지해 기존 설치 앱의 정체성을 보존한다.
- 회원 앱은 Firestore의 `published/current` 문서 한 건만 읽는다.
- 원본 편집 데이터와 공개 데이터를 분리하며, 관리자가 발행할 때 공개 스냅샷을 만든다.

## Firebase 프로젝트

| 환경 | 용도 | 도메인 |
|---|---|---|
| staging | 개발·QA·기기 테스트 | Firebase preview channel 또는 별도 스테이징 도메인 |
| production | 실제 회원 서비스 | `www.everydaywjesus.com` |

운영과 스테이징은 별도 Firebase 프로젝트를 사용한다. `.env`와 `.firebaserc`는 저장소에 커밋하지 않는다.

## 관리자·이관 도구

- 보안 규칙 테스트: Java 21 이상 설치 후 `npm run test:rules`
- 최초 관리자 지정: `firebase-admin@14.3.0`을 임시 설치하고 `scripts/set-admin.mjs`를 명시적 `--confirm`과 함께 실행
- 초기 데이터 이관: 동일한 인증 환경에서 `scripts/seed-firebase.mjs --confirm` 실행
- 두 쓰기 스크립트는 프로젝트 ID와 서비스 계정이 없으면 실행되지 않는다.

## 데이터 구조

- `resources/{id}`: 설교, 도서, 치유, 기도, 찬양, 성경, 링크, 영상
- `notices/{id}`: 공지 본문과 Storage 이미지 경로
- `churches/{id}`: 지교회 정보
- `siteSettings/current`: 사이트 설정과 외부 링크
- `auditLogs/{id}`: 관리자 변경 이력(수정·삭제 불가)
- `published/current`: 회원 앱이 읽는 검증된 공개 스냅샷

이미지는 Firestore 문서의 Base64가 아니라 Storage에 WebP/JPEG 파일로 저장한다. 원본 최대 폭은 1600px, 목록용 썸네일은 약 480px을 권장한다.

## 배포 게이트

1. 단위 테스트와 TypeScript 검사
2. Firebase Emulator 규칙 테스트
3. Vite production build
4. Preview channel 배포
5. Galaxy Samsung Internet/Chrome, iOS Safari/PWA, Windows/macOS 데스크톱 QA
6. 기존 설치 PWA의 업데이트 확인
7. 운영 데이터 최종 동기화 후 도메인 전환
8. 오류 발생 시 이전 Hosting 릴리스로 롤백
