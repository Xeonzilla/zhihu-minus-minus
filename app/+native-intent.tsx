import { isExpoInternalUrl, parseZhihuUrl } from '@/utils/url';

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string | null {
  if (isExpoInternalUrl(path)) return path;

  return parseZhihuUrl(path);
}
