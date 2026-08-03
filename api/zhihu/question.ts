import type { ZhihuAuthor, ZhihuBadgeV2 } from '@/types/zhihu';
import apiClient from '../client';

export interface ZhihuQuestionBrief {
  created: number;
  id: string | number;
  question_type: string;
  relationship: any;
  title: string;
  type: 'question';
  updated_time: number;
  url: string;
}

export interface ZhihuAnswerRelationship {
  upvoted_followees: any[];
  voting?: number;
  is_author?: boolean;
}

export interface ZhihuAnswer {
  allow_segment_interaction: number;
  answer_type: string;
  author: ZhihuAuthor;
  comment_count: number;
  content: string;
  content_need_truncated: boolean;
  created_time: number;
  extras: string;
  force_login_when_click_read_more: boolean;
  id: string | number;
  is_collapsed: boolean;
  is_copyable: boolean;
  is_jump_native: boolean;
  question: ZhihuQuestionBrief;
  relationship: ZhihuAnswerRelationship;
  type: 'answer';
  updated_time: number;
  url: string;
  voteup_count: number;
  thumbnail?: string;
  content_img?: string[];
  segment_infos?: any[];
}

export interface ZhihuAnswersPaging {
  is_end: boolean;
  is_start: boolean;
  next: string;
  previous: string;
  totals: number;
}

export interface ZhihuAnswersResponse {
  data: ZhihuAnswer[];
  paging: ZhihuAnswersPaging;
  read_count: number;
}

export const QUESTION_INCLUDE =
  'detail,excerpt,answer_count,comment_count,follower_count,visit_count,topics,relationship.is_following,relationship.is_author,relationship.is_anonymous,relationship.voting,relationship.is_thanked,relationship.is_nothelp';

export const getQuestion = async (id: string | number, include?: string) => {
  const res = await apiClient.get(
    `/questions/${id}?include=${include || QUESTION_INCLUDE}`,
  );
  return res.data;
};

export const followQuestion = async (id: string | number) => {
  const res = await apiClient.post(`/questions/${id}/followers`);
  return res.data;
};

export const unfollowQuestion = async (id: string | number) => {
  const res = await apiClient.delete(`/questions/${id}/followers`);
  return res.data;
};

export const createQuestion = async (title: string, content: string) => {
  const timestamp = Date.now();
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
  const traceId = `${timestamp},${uuid}`;

  const payload = {
    action: 'question',
    data: {
      publish: { traceId },
      draft: { isPublished: false, disabled: 1 },
      question: {
        title,
        detail: content,
        topics: [],
        is_anonymous: false,
      },
    },
  };

  const res = await apiClient.post('/content/publish', payload);
  return res.data;
};
