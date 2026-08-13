export interface ZhihuBadge {
  type: string;
  description: string;
}

export interface ZhihuDetailBadge {
  type?: string;
  detail_type?: string;
  title?: string;
  description?: string;
  url?: string;
  icon?: string;
  night_icon?: string;
  sources?: any[];
}

export interface ZhihuMergedBadge {
  type?: string;
  detail_type?: string;
  title?: string;
  description?: string;
  url?: string;
  icon?: string;
  night_icon?: string;
  sources?: any[];
}

export interface ZhihuBadgeV2 {
  title: string;
  icon: string;
  night_icon: string;
  detail_badges?: ZhihuDetailBadge[] | any[];
  merged_badges?: ZhihuMergedBadge[] | any[];
}

export interface ZhihuAuthor {
  id: string;
  name: string;
  avatar_url: string;
  avatar_url_template?: string;
  headline?: string;
  url_token?: string;
  user_type?: string;
  type: string;
  is_org?: boolean;
  gender?: number;
  url?: string;
  is_advertiser?: boolean;
  is_privacy?: boolean;
  is_following?: boolean;
  badge?: ZhihuBadge[] | any[];
  badge_v2?: ZhihuBadgeV2;
}

export interface ZhihuQuestion {
  id: string | number;
  title: string;
  created?: number;
  updated_time?: number;
  question_type?: string;
  type: 'question';
  url?: string;
  answer_count?: number;
  follower_count?: number;
  author?: ZhihuAuthor;
  relationship?: {
    voting?: number;
    is_following?: boolean;
  };
}

export interface ZhihuReaction {
  statistics: {
    like_count: number;
    favorites?: number;
  };
  relation?: {
    faved?: boolean;
    liked?: boolean;
    vote?: 'UP' | 'DOWN' | 'NEUTRAL';
  };
}

export interface ZhihuAnswer {
  id: string | number;
  content: string;
  excerpt: string;
  created_time: number;
  updated_time: number;
  comment_count: number;
  voteup_count?: number;
  reaction_count?: number;
  reaction?: ZhihuReaction;
  author: ZhihuAuthor;
  question: {
    id: string | number;
    title: string;
    type: 'question';
  };
  type: 'answer';
  url?: string;
  relationship?: {
    voting?: number;
    is_thanked?: boolean;
  };
}

export interface ZhihuArticle {
  id: string | number;
  title: string;
  content: string;
  excerpt: string;
  created: number;
  updated: number;
  comment_count: number;
  voteup_count?: number;
  author: ZhihuAuthor;
  type: 'article';
  url?: string;
  relationship?: {
    voting?: number;
  };
}

export interface ZhihuPin {
  id: string | number;
  content: string;
  excerpt?: string;
  created: number;
  comment_count: number;
  reaction_count?: number;
  author: ZhihuAuthor;
  type: 'pin';
  url?: string;
  relationship?: {
    voting?: number;
  };
}

export interface ZhihuVideo {
  id: string | number;
  title: string;
  excerpt?: string;
  created?: number;
  comment_count?: number;
  voteup_count?: number;
  author?: ZhihuAuthor;
  type: 'zvideo' | 'video';
  url?: string;
  relationship?: {
    voting?: number;
  };
}

export type ZhihuMemberRelation =
  | ZhihuAnswer
  | ZhihuQuestion
  | ZhihuArticle
  | ZhihuPin
  | ZhihuVideo;

export interface ZhihuSearchHighlight {
  description?: string;
  title?: string;
}

export interface ZhihuSearchResultItem {
  type: 'search_result';
  highlight: ZhihuSearchHighlight;
  object: ZhihuMemberRelation;
  index: number;
}

export interface ZhihuSearchResponse {
  paging: {
    is_end: boolean;
    next: string;
  };
  data: ZhihuSearchResultItem[];
}

export interface ZhihuColumnDetail {
  id: string;
  type: 'column';
  title: string;
  url: string;
  image_url: string;
  updated: number;
  column_type: string;
  accept_submission: boolean;
  comment_permission: string;
  intro?: string;
  excerpt?: string;
  extra?: string;
  followers?: number;
  items_count?: number;
  articles_count?: number;
  author: ZhihuAuthor;
  is_following?: boolean;
}

export interface ZhihuPaging {
  is_end: boolean;
  is_start?: boolean;
  next: string;
  previous?: string;
  totals?: number;
}
