import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import apiClient from '../client';

export interface FeedAuthor {
  id: string;
  url_token?: string;
  name: string;
  avatar: string;
  headline?: string;
}

export interface FeedTopic {
  id: string;
  name: string;
}

export interface FeedItem {
  id: string;
  title: any;
  questionId?: string;
  actionText?: string;
  author: FeedAuthor;
  excerpt: any;
  content: string;
  image: string | null;
  voteCount: number;
  commentCount: number;
  favlistsCount?: number;
  voted: number;
  type: 'answers' | 'articles' | 'pins' | 'questions';
  topics: FeedTopic[];
  rank?: number;
  hotValue?: string;
  titleString?: string;
}

export interface RawFeedTarget {
  id: string | number;
  type: string;
  title?: string;
  excerpt?: string;
  content?: any;
  thumbnail?: string;
  content_img?: string[];
  voteup_count?: number;
  like_count?: number;
  comment_count?: number;
  favlists_count?: number;
  favorite_count?: number;
  reaction?: {
    relation?: {
      liked?: boolean;
      faved?: boolean;
    };
    statistics?: {
      like_count?: number;
      favorites?: number;
    };
  };
  relationship?: {
    voting?: number;
  };
  author?: {
    id: string;
    name: string;
    avatar_url: string;
    headline?: string;
    url_token?: string;
  };
  question?: {
    id: string | number;
    title: string;
  };
  topics?: Array<{
    id: string;
    name: string;
  }>;
  url?: string;
  detail_text?: string;
  // Hot List specific fields:
  title_area?: {
    text: string;
  };
  excerpt_area?: {
    text: string;
  };
  image_area?: {
    url: string;
  };
  metrics_area?: {
    text: string;
    font_color?: string;
    background?: string;
    weight?: string;
  };
  label_area?: {
    type: string;
    trend?: number;
    text?: string;
    night_color?: string;
    normal_color?: string;
  };
  link?: {
    url: string;
  };
}

export interface RawFeedItem {
  id?: string | number;
  type?: string;
  action_text?: string;
  target?: RawFeedTarget;
  children?: Array<{
    thumbnail?: string;
  }>;
  image_url?: string;
  // Hot List specific fields
  card_id?: string;
  card_label?: {
    type: string;
    icon: string;
    night_icon: string;
  };
  feed_specific?: {
    answer_count: number;
  };
}

export interface ZhihuFeedResponse {
  data: RawFeedItem[];
  paging: {
    is_end: boolean;
    is_start: boolean;
    next: string;
    previous: string;
  };
}

export const FEED_URLS = {
  following: 'https://www.zhihu.com/api/v3/moments?limit=10',
  recommend: 'https://www.zhihu.com/api/v3/feed/topstory/recommend?limit=10',
  local: 'zhihu://local-feed',
  hot: 'https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=50',
};

export const getFeed = async (url: string): Promise<ZhihuFeedResponse> => {
  let finalUrl = url;
  const { cookies } = useAuthStore.getState();

  // 如果未登录且请求的是推荐页初始接口，则切换为游客接口
  if (!cookies && url.includes('feed/topstory/recommend')) {
    finalUrl =
      'https://www.zhihu.com/api/v3/explore/guest/feeds?limit=15&ws_qiangzhisafe=0';
  }

  if (url === 'zhihu://local-feed') {
    // 1. Fetch sections to find the local section ID
    try {
      const sectionsRes = await apiClient.get(
        'https://api.zhihu.com/feed-root/sections/query/v2',
      );
      const sections = sectionsRes.data?.data || [];
      const localSection = sections.find(
        (s: any) => s.section_name?.includes('同城') || s.section_id,
      );

      if (localSection && localSection.section_id) {
        finalUrl = `https://api.zhihu.com/feed-root/section/${localSection.section_id}?channelStyle=0`;
        if (localSection.section_name) {
          useSettingsStore
            .getState()
            .updateSettings({ localCityName: localSection.section_name });
        }
      } else {
        throw new Error('未找到同城版块');
      }
    } catch (err) {
      console.warn('获取同城版块失败，回退到推荐流', err);
      finalUrl = FEED_URLS.recommend;
    }
  } else if (url.startsWith('zhihu://local-feed/')) {
    finalUrl = url.replace(
      'zhihu://local-feed/',
      'https://api.zhihu.com/feed-root/section/',
    );
  }

  const res = await apiClient.get<ZhihuFeedResponse>(finalUrl);

  if (url.startsWith('zhihu://local-feed')) {
    // Override the next URL to use our custom scheme so we can intercept it again
    if (res.data?.paging?.next) {
      res.data.paging.next = res.data.paging.next.replace(
        'https://api.zhihu.com/feed-root/section/',
        'zhihu://local-feed/',
      );
    }
  }

  return res.data;
};
