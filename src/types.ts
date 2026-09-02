export type SectionId = 'notices' | 'sermon' | 'books' | 'healing' | 'prayer' | 'praise' | 'bible' | 'churches' | 'links' | 'truth';

export interface ResourceItem {
  id: string;
  section: Exclude<SectionId, 'notices' | 'churches'>;
  title: string;
  subtitle?: string;
  url: string;
  thumbnailUrl?: string;
  label?: string;
  order: number;
}

export interface NoticeItem {
  id: string;
  title: string;
  body?: string;
  date?: string;
  imageUrls?: string[];
  linkUrl?: string;
  linkText?: string;
  order: number;
}

export interface ChurchItem {
  id: string;
  name: string;
  region: string;
  address?: string;
  phone?: string;
  url?: string;
  order: number;
}

export interface PublishedSnapshot {
  schemaVersion: 2;
  publishedAt: string;
  notices: NoticeItem[];
  resources: ResourceItem[];
  churches: ChurchItem[];
  settings: {
    siteName: string;
    supportUrl?: string;
    inquiryUrl?: string;
  };
}
