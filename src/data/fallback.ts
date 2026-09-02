import type { PublishedSnapshot } from '../types';

export const fallbackSnapshot: PublishedSnapshot = {
  schemaVersion: 2,
  publishedAt: '2026-09-02T00:00:00.000Z',
  notices: [],
  resources: [
    { id: 'daily-prayer', section: 'prayer', title: '매일 기도 플레이리스트', subtitle: 'YouTube 재생목록', url: 'https://www.youtube.com/playlist?list=PLNFQy-3DVkT-CsYiuJi_roaTSGO6ds4y1', order: 0 },
    { id: 'old-testament', section: 'bible', title: '구약 성경 통독', subtitle: 'YouTube 재생목록', url: 'https://www.youtube.com/playlist?list=PLkwxjHscKmIlrRNkDvp1Yj2vWH4SEpUyO', order: 0 },
    { id: 'new-testament', section: 'bible', title: '신약 성경 통독', subtitle: 'YouTube 재생목록', url: 'https://www.youtube.com/playlist?list=PLkwxjHscKmIlWy8N59dtWS8WGY-xj_YX9', order: 1 },
    { id: 'beloved-church', section: 'links', title: '사랑하는교회 홈페이지', subtitle: 'www.belovedc.com', label: '공식 홈페이지', url: 'https://www.belovedc.com', order: 0 }
  ],
  churches: [],
  settings: {
    siteName: '매일 예수님과 함께',
    supportUrl: 'https://influencers.coupang.com/s/kingofsallim',
    inquiryUrl: 'https://open.kakao.com/o/sbqrs0jh'
  }
};
