export function isExpoInternalUrl(url: string): boolean {
  return (
    url.includes('expo-development-client') ||
    url.includes('expo-auth-session')
  );
}

/**
 * 解析并规范化知乎链接，将其转换为应用内的路由路径
 * @param url 原始 URL (可以是 http/https 链接，也可以是 deep link)
 * @returns 规范化的内部路径，如果无法解析为内部路径则返回 null
 */
export function parseZhihuUrl(url: string | null): string | null {
  if (!url) return null;

  // 1. 提取路径部分
  let path = '';
  try {
    if (url.includes('://')) {
      const parts = url.split('://');
      const rest = parts[1] !== undefined ? parts[1] : '';

      if (url.startsWith('http')) {
        // 处理 http(s) 链接: https://www.zhihu.com/question/123 -> /question/123
        const match = rest.match(/^[^/]+(\/.*)$/);
        path = match ? match[1] : '/';
      } else {
        // 处理自定义 scheme: zhihu://question/123 -> /question/123
        path = rest.startsWith('/') ? rest : '/' + rest;
      }
    } else {
      // 已经是路径形式
      path = url.startsWith('/') ? url : '/' + url;
    }

    // 2. 规范化路径：移除 oia (移动端优化页前缀), 统一单复数
    path = path.replace(/^\/oia\//, '/');
    path = path.replace(/^\/questions?\//, '/question/');
    path = path.replace(/^\/answers?\//, '/answer/');
    path = path.replace(/^\/people\//, '/user/');
    path = path.replace(/^\/articles?\//, '/article/');
    path = path.replace(/^\/p\//, '/article/');
    path = path.replace(/^\/pins?\//, '/pin/');

    // 3. 清理查询参数
    const cleanPath = path.split('?')[0];

    // 4. 处理首页/空路径
    if (
      !cleanPath ||
      cleanPath === '/' ||
      cleanPath === '/oia' ||
      cleanPath === '/feed' ||
      cleanPath === '/home' ||
      cleanPath === '/follow'
    ) {
      return '/';
    }

    // 5. 特殊处理：裸 ID 启发式判断 (知乎深度链接有时只带 ID)
    // 裸的长 ID (15-25位): 通常是回答 ID 或问题 ID
    if (/^\/\d{15,25}$/.test(cleanPath)) {
      const id = cleanPath.substring(1);
      // 知乎问题 ID 通常以 19 开头（目前规律），否则可能是回答 ID
      return id.startsWith('19') ? `/question/${id}` : `/answer/${id}`;
    }
    // 裸的短 ID (8-14位): 通常是问题 ID
    else if (/^\/\d{8,14}$/.test(cleanPath)) {
      return `/question/${cleanPath.substring(1)}`;
    }

    return cleanPath;
  } catch (err) {
    console.error('[URL Parser] Failed to parse:', url, err);
    return null;
  }
}

/**
 * 判断是否为知乎内部链接
 */
export function isInternalZhihuLink(url: string): boolean {
  return (
    url.includes('zhihu.com') ||
    url.startsWith('zhihu://') ||
    url.startsWith('/')
  );
}

/**
 * 解码知乎跳转链接，提取真实目标 URL
 * 知乎外部链接格式: https://link.zhihu.com/?target=https%3A%2F%2F...
 */
export function extractZhihuRedirectTarget(url: string): string {
  try {
    if (url.includes('link.zhihu.com')) {
      const parsed = new URL(url);
      const target = parsed.searchParams.get('target');
      if (target) return decodeURIComponent(target);
    }
  } catch (_) {}
  return url;
}
