import apiClient from '../client';

export const CONTENT_TYPES = [
  'answer',
  'question',
  'article',
  'pin',
  'zvideo',
  'video',
  'column',
  'profile',
] as const;

export type ReadHistoryContentType = (typeof CONTENT_TYPES)[number];

export interface AddReadHistoryPayload {
  content_token: string;
  content_type: ReadHistoryContentType;
}

export interface ReadHistoryHeader {
  title: string;
}

export interface ReadHistoryContent {
  summary: string;
}

export interface ReadHistoryMatrixItem {
  data: {
    text: string;
  };
}

export interface ReadHistoryExtra {
  content_token: string;
  content_type: string;
  read_time: number;
}

export interface ReadHistoryDataItem {
  id: string;
  data: {
    header: ReadHistoryHeader;
    content: ReadHistoryContent;
    matrix: ReadHistoryMatrixItem[];
    extra: ReadHistoryExtra;
  };
}

export interface ReadHistoryPaging {
  is_end: boolean;
  is_start: boolean;
  next: string;
  previous: string;
}

export interface ReadHistoryResponse {
  paging: ReadHistoryPaging;
  data: ReadHistoryDataItem[];
}

export const addReadHistory = async (payload: AddReadHistoryPayload) => {
  const res = await apiClient.post('/read_history/add', payload);
  return res.data;
};

export interface BatchDelReadHistoryPayload {
  pairs?: AddReadHistoryPayload[];
  clear: boolean;
}

export const batchDelReadHistory = async (
  payload: BatchDelReadHistoryPayload,
) => {
  const res = await apiClient.post('/read_history/batch_del', payload);
  return res.data;
};

export const getReadHistory = async (
  limit = 20,
  offset = 0,
): Promise<ReadHistoryResponse> => {
  const res = await apiClient.get<ReadHistoryResponse>(
    `/unify-consumption/read_history?limit=${limit}&offset=${offset}`,
  );
  return res.data;
};
