// nodetree.kr 배포 환경 감지
const isNodeTreeSite = typeof window !== 'undefined' &&
  (window.location.hostname === 'nodetree.kr' || window.location.hostname === 'www.nodetree.kr');

// nodetree.kr에서는 환경변수 무시하고 자체 API 사용
const API_BASE_URL = isNodeTreeSite
  ? '/api'
  : (process.env.REACT_APP_API_URL ||
     (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api'));

// 추가된 디버깅 코드
console.log('Current API_BASE_URL:', API_BASE_URL);
console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
console.log('isNodeTreeSite:', isNodeTreeSite);

// ============ 캐시 유틸리티 ============
const CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시
const STALE_DURATION = 30 * 60 * 1000; // 30분 동안은 stale 데이터 사용 가능

// [async-parallel] 진행 중인 요청 추적 (중복 요청 방지)
const pendingRequests = new Map();

const cacheUtils = {
  // 캐시에서 데이터 가져오기
  get: (key) => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > CACHE_DURATION;

      if (isExpired) {
        localStorage.removeItem(key);
        return null;
      }

      return data;
    } catch (e) {
      return null;
    }
  },

  // [SWR 패턴] stale 데이터도 반환 (만료되었지만 30분 이내)
  getWithStale: (key) => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return { data: null, isStale: false };

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      const isStale = age > CACHE_DURATION;
      const isTooOld = age > STALE_DURATION;

      if (isTooOld) {
        localStorage.removeItem(key);
        return { data: null, isStale: false };
      }

      return { data, isStale };
    } catch (e) {
      return { data: null, isStale: false };
    }
  },

  // 캐시에 데이터 저장
  set: (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      // localStorage 용량 초과 시 기존 캐시 정리
      try {
        localStorage.clear();
        localStorage.setItem(key, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      } catch (e2) {
        console.warn('캐시 저장 실패:', e2);
      }
    }
  },

  // 특정 캐시 삭제
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // ignore
    }
  },

  // 특정 prefix로 시작하는 캐시 모두 삭제
  clearByPrefix: (prefix) => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      // ignore
    }
  }
};

const CACHE_KEYS = {
  WORK_POSTS: 'cache_work_posts',
  WORK_HEADER: 'cache_work_header',
  FILED_POSTS: 'cache_filed_posts',
  FILED_HEADER: 'cache_filed_header',
  ABOUT: 'cache_about',
  CV: 'cache_cv',
  HUMAN_HEADER: 'cache_human_header',
  CONTACT: 'cache_contact',
  HOME: 'cache_home',
  SSO_EXHIBITIONS: 'cache_sso_exhibitions',
  SSO_PROJECTS: 'cache_sso_projects',
  SSO_NEWS: 'cache_sso_news',
  SSO_ARCHIVES: 'cache_sso_archives',
  SSO_SLIDES: 'cache_sso_slides',
};

// 토큰을 가져오는 헬퍼 함수
const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

// 401 응답 시 자동 로그아웃 처리
const handle401 = (serverMessage) => {
  const token = localStorage.getItem('auth_token');
  const msg = serverMessage || (token ? '토큰이 만료되었거나 유효하지 않습니다.' : '로그인이 필요합니다.');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  alert(`로그인이 필요합니다. 다시 로그인해주세요.\n(${msg})`);
  window.location.href = '/login';
};

// 인증 헤더를 포함한 기본 헤더 생성
const getHeaders = () => {
  const headers = {
    'Content-Type': 'application/json'
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

// [async-parallel] 중복 요청 방지 래퍼 - 같은 URL 요청이 진행 중이면 기존 Promise 재사용
// Response를 clone하여 반환해야 여러 곳에서 .json() 호출 가능
const deduplicatedFetch = async (url, options = {}) => {
  const key = `${options.method || 'GET'}:${url}`;

  // 이미 진행 중인 요청이 있으면 clone된 Response 반환
  if (pendingRequests.has(key)) {
    const response = await pendingRequests.get(key);
    return response.clone();
  }

  // 새 요청 시작
  const requestPromise = fetchWithRetry(url, options);

  pendingRequests.set(key, requestPromise);

  try {
    const response = await requestPromise;
    return response.clone();
  } finally {
    // 요청 완료 후 Map에서 제거
    pendingRequests.delete(key);
  }
};

// 재시도 로직이 포함된 fetch 함수
const fetchWithRetry = async (url, options = {}, retries = 3, timeout = 10000) => {
  for (let i = 0; i < retries; i++) {
    try {
      // 타임아웃 구현
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // 서버 에러(503 등)인 경우 재시도
      if (response.status >= 500 && i < retries - 1) {
        console.log(`서버 에러 (${response.status}), ${i + 1}/${retries} 재시도 중...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // 점진적 대기
        continue;
      }

      return response;
    } catch (error) {
      // 타임아웃 또는 네트워크 에러
      if (error.name === 'AbortError') {
        console.log(`요청 타임아웃, ${i + 1}/${retries} 재시도 중...`);
      } else {
        console.log(`네트워크 에러: ${error.message}, ${i + 1}/${retries} 재시도 중...`);
      }

      // 마지막 시도였다면 에러 throw
      if (i === retries - 1) {
        throw error;
      }

      // 재시도 전 대기 (점진적으로 증가)
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

// Work API
export const workAPI = {
  // 모든 글 조회 (SWR 패턴 적용)
  getAllPosts: async (options = {}) => {
    const { forceRefresh = false } = options;

    // 캐시 확인 (SWR 패턴)
    if (!forceRefresh) {
      const { data: cached, isStale } = cacheUtils.getWithStale(CACHE_KEYS.WORK_POSTS);
      if (cached) {
        console.log(`Work posts: 캐시에서 로드 (${isStale ? 'stale' : 'fresh'})`);
        // stale 데이터인 경우 백그라운드에서 갱신
        if (isStale) {
          workAPI._backgroundRefreshPosts();
        }
        return cached;
      }
    }

    const url = cdnBustUrl(`${API_BASE_URL}/work`, 'work_updated');
    const response = await deduplicatedFetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch posts');
    }
    const data = await response.json();

    // 성공 시 캐시 저장 (데이터가 실제로 있을 때만 캐싱)
    if (data.success && Array.isArray(data.data) && data.data.length > 0) {
      cacheUtils.set(CACHE_KEYS.WORK_POSTS, data);
    }

    return data;
  },

  // 백그라운드 갱신
  _backgroundRefreshPosts: async () => {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/work`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          cacheUtils.set(CACHE_KEYS.WORK_POSTS, data);
          console.log('Work posts: 백그라운드 갱신 완료');
        }
      }
    } catch (e) {
      // 무시
    }
  },

  // 새 글 작성
  createPost: async (postData) => {
    const response = await fetch(`${API_BASE_URL}/work`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(postData)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) return handle401(errorData.message);
      if (response.status === 403) throw new Error('관리자 권한이 필요합니다.');
      console.error('Work createPost 오류:', response.status, errorData);
      throw new Error(errorData.message || `Failed to create post (${response.status})`);
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.WORK_POSTS);
    markCdnDirty('work_updated');
    return data;
  },

  // 글 수정
  updatePost: async (id, postData) => {
    const response = await fetch(`${API_BASE_URL}/work/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(postData)
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      const errorData = await response.json().catch(() => ({}));
      console.error('Work updatePost 오류:', response.status, errorData);
      throw new Error(errorData.message || `Failed to update post (${response.status})`);
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.WORK_POSTS);
    markCdnDirty('work_updated');
    return data;
  },

  // 글 삭제
  deletePost: async (id) => {
    const response = await fetch(`${API_BASE_URL}/work/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      const errorData = await response.json().catch(() => ({}));
      console.error('Work deletePost 오류:', response.status, errorData);
      throw new Error(errorData.message || `Failed to delete post (${response.status})`);
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.WORK_POSTS);
    markCdnDirty('work_updated');
    return data;
  },

  // 상단 제목/부제목 단일 데이터 조회 (SWR 패턴)
  getWorkHeader: async (options = {}) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh) {
      const { data: cached, isStale } = cacheUtils.getWithStale(CACHE_KEYS.WORK_HEADER);
      if (cached) {
        console.log(`Work header: 캐시에서 로드 (${isStale ? 'stale' : 'fresh'})`);
        if (isStale) {
          workAPI._backgroundRefreshHeader();
        }
        return cached;
      }
    }

    const response = await deduplicatedFetch(`${API_BASE_URL}/work/header`);
    if (!response.ok) {
      throw new Error('Failed to fetch work header');
    }
    const data = await response.json();

    if (data.success) {
      cacheUtils.set(CACHE_KEYS.WORK_HEADER, data);
    }

    return data;
  },

  _backgroundRefreshHeader: async () => {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/work/header`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          cacheUtils.set(CACHE_KEYS.WORK_HEADER, data);
        }
      }
    } catch (e) {
      // 무시
    }
  },

  // 상단 제목/부제목 단일 데이터 수정
  updateWorkHeader: async (headerData) => {
    const response = await fetch(`${API_BASE_URL}/work/header`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(headerData)
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to update work header');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.WORK_HEADER);
    return data;
  },

  // 리서치 아카이브 조회 (로그인 필수)
  getResearch: async (id) => {
    const response = await fetch(`${API_BASE_URL}/work/${id}/research`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) return handle401(errorData.message);
      if (response.status === 404) throw new Error('작품을 찾을 수 없습니다.');
      throw new Error(errorData.message || `리서치 조회 실패 (${response.status})`);
    }
    return response.json();
  },

  // 리서치 sync 상태만 확인 (인증 불필요)
  getResearchStatus: async (id) => {
    const response = await fetch(`${API_BASE_URL}/work/${id}/research/status`);
    if (!response.ok) return { success: false, data: { synced: false } };
    return response.json();
  },

  // 옵시디안 폴더에서 마스터 노트 + 리서치 동기화 (admin only)
  syncObsidian: async (id, obsidianPath) => {
    const response = await fetch(`${API_BASE_URL}/work/${id}/sync-obsidian`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(obsidianPath ? { obsidianPath } : {})
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) return handle401(errorData.message);
      if (response.status === 403) throw new Error('관리자 권한이 필요합니다.');
      if (response.status === 503) throw new Error(errorData.message || '동기화는 로컬 환경에서만 동작합니다.');
      throw new Error(errorData.message || `동기화 실패 (${response.status})`);
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.WORK_POSTS);
    markCdnDirty('work_updated');
    return data;
  },

  // 글 순서 변경
  reorderPosts: async (orders) => {
    const response = await fetch(`${API_BASE_URL}/work/reorder`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ orders })
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to reorder posts');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.WORK_POSTS);
    return data;
  },

  // 이미지 레이아웃 저장
  updateImageLayout: async (id, imageLayout) => {
    const response = await fetch(`${API_BASE_URL}/work/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ imageLayout })
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to update image layout');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.WORK_POSTS);
    return data;
  }
};

// Filed API
export const filedAPI = {
  // 모든 기록 조회 (SWR 패턴 적용)
  getAllPosts: async (options = {}) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh) {
      const { data: cached, isStale } = cacheUtils.getWithStale(CACHE_KEYS.FILED_POSTS);
      if (cached) {
        console.log(`Filed posts: 캐시에서 로드 (${isStale ? 'stale' : 'fresh'})`);
        if (isStale) {
          filedAPI._backgroundRefreshPosts();
        }
        return cached;
      }
    }

    const response = await deduplicatedFetch(`${API_BASE_URL}/filed`);
    if (!response.ok) {
      throw new Error('Failed to fetch posts');
    }
    const data = await response.json();

    // 성공 시 캐시 저장 (데이터가 실제로 있을 때만 캐싱)
    if (data.success && Array.isArray(data.data) && data.data.length > 0) {
      cacheUtils.set(CACHE_KEYS.FILED_POSTS, data);
    }

    return data;
  },

  _backgroundRefreshPosts: async () => {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/filed`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          cacheUtils.set(CACHE_KEYS.FILED_POSTS, data);
          console.log('Filed posts: 백그라운드 갱신 완료');
        }
      }
    } catch (e) {
      // 무시
    }
  },

  // 새 기록 작성
  createPost: async (postData) => {
    const response = await fetch(`${API_BASE_URL}/filed`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(postData)
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      const errorData = await response.json().catch(() => ({}));
      console.error('Filed createPost 오류:', response.status, errorData);
      throw new Error(errorData.message || `Failed to create post (${response.status})`);
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.FILED_POSTS);
    return data;
  },

  // 기록 수정
  updatePost: async (id, postData) => {
    const response = await fetch(`${API_BASE_URL}/filed/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(postData)
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      const errorData = await response.json().catch(() => ({}));
      console.error('Filed updatePost 오류:', response.status, errorData);
      throw new Error(errorData.message || `Failed to update post (${response.status})`);
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.FILED_POSTS);
    return data;
  },

  // 기록 삭제
  deletePost: async (id) => {
    const response = await fetch(`${API_BASE_URL}/filed/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      const errorData = await response.json().catch(() => ({}));
      console.error('Filed deletePost 오류:', response.status, errorData);
      throw new Error(errorData.message || `Failed to delete post (${response.status})`);
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.FILED_POSTS);
    return data;
  },

  // 상단 제목/부제목 단일 데이터 조회 (SWR 패턴)
  getFiledHeader: async (options = {}) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh) {
      const { data: cached, isStale } = cacheUtils.getWithStale(CACHE_KEYS.FILED_HEADER);
      if (cached) {
        console.log(`Filed header: 캐시에서 로드 (${isStale ? 'stale' : 'fresh'})`);
        if (isStale) {
          filedAPI._backgroundRefreshHeader();
        }
        return cached;
      }
    }

    const response = await deduplicatedFetch(`${API_BASE_URL}/filed/header`);
    if (!response.ok) {
      throw new Error('Failed to fetch filed header');
    }
    const data = await response.json();

    if (data.success) {
      cacheUtils.set(CACHE_KEYS.FILED_HEADER, data);
    }

    return data;
  },

  _backgroundRefreshHeader: async () => {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/filed/header`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          cacheUtils.set(CACHE_KEYS.FILED_HEADER, data);
        }
      }
    } catch (e) {
      // 무시
    }
  },

  // 상단 제목/부제목 단일 데이터 수정
  updateFiledHeader: async (headerData) => {
    const response = await fetch(`${API_BASE_URL}/filed/header`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(headerData)
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to update filed header');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.FILED_HEADER);
    return data;
  },

  // 글 순서 변경
  reorderPosts: async (orders) => {
    const response = await fetch(`${API_BASE_URL}/filed/reorder`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ orders })
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to reorder posts');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.FILED_POSTS);
    return data;
  },

  // 이미지 레이아웃 저장
  updateImageLayout: async (id, imageLayout) => {
    const response = await fetch(`${API_BASE_URL}/filed/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ imageLayout })
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to update image layout');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.FILED_POSTS);
    return data;
  }
};

// About API
export const aboutAPI = {
  getAbout: async (options = {}) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh) {
      const { data: cached, isStale } = cacheUtils.getWithStale(CACHE_KEYS.ABOUT);
      if (cached) {
        console.log(`About: 캐시에서 로드 (${isStale ? 'stale' : 'fresh'})`);
        if (isStale) {
          aboutAPI._backgroundRefresh();
        }
        return cached;
      }
    }

    const response = await deduplicatedFetch(`${API_BASE_URL}/about`);
    if (!response.ok) {
      throw new Error('Failed to fetch about content');
    }
    const data = await response.json();

    if (data.success) {
      cacheUtils.set(CACHE_KEYS.ABOUT, data);
    }

    return data;
  },

  _backgroundRefresh: async () => {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/about`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          cacheUtils.set(CACHE_KEYS.ABOUT, data);
        }
      }
    } catch (e) {
      // 무시
    }
  },

  updateAbout: async (aboutData) => {
    const response = await fetch(`${API_BASE_URL}/about`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(aboutData)
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to update about content');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.ABOUT);
    return data;
  }
};

// CV API
export const cvAPI = {
  getCV: async (options = {}) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh) {
      const { data: cached, isStale } = cacheUtils.getWithStale(CACHE_KEYS.CV);
      if (cached) {
        console.log(`CV: 캐시에서 로드 (${isStale ? 'stale' : 'fresh'})`);
        if (isStale) {
          cvAPI._backgroundRefresh();
        }
        return cached;
      }
    }

    const response = await deduplicatedFetch(`${API_BASE_URL}/cv`);
    if (!response.ok) {
      throw new Error('Failed to fetch CV');
    }
    const data = await response.json();

    if (data.success) {
      cacheUtils.set(CACHE_KEYS.CV, data);
    }

    return data;
  },

  _backgroundRefresh: async () => {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/cv`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          cacheUtils.set(CACHE_KEYS.CV, data);
        }
      }
    } catch (e) {
      // 무시
    }
  },
  updateCV: async (cvData) => {
    const response = await fetch(`${API_BASE_URL}/cv`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(cvData)
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to update CV');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.CV);
    return data;
  }
};


export const humanAPI = {
  getHumanHeader: async (options = {}) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh) {
      const cached = cacheUtils.get(CACHE_KEYS.HUMAN_HEADER);
      if (cached) {
        console.log('Human header: 캐시에서 로드');
        return cached;
      }
    }

    const response = await fetchWithRetry(`${API_BASE_URL}/human/header`);
    if (!response.ok) {
      throw new Error('Failed to fetch human header');
    }
    const data = await response.json();

    if (data.success) {
      cacheUtils.set(CACHE_KEYS.HUMAN_HEADER, data);
    }

    return data;
  },
  updateHumanHeader: async (headerData) => {
    const response = await fetch(`${API_BASE_URL}/human/header`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(headerData)
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to update human header');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.HUMAN_HEADER);
    return data;
  }
};

// Home API
export const homeAPI = {
  // Home 설정 조회 (SWR 패턴)
  getHome: async (options = {}) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh) {
      const { data: cached, isStale } = cacheUtils.getWithStale(CACHE_KEYS.HOME);
      if (cached) {
        console.log(`Home: 캐시에서 로드 (${isStale ? 'stale' : 'fresh'})`);
        if (isStale) {
          homeAPI._backgroundRefresh();
        }
        return cached;
      }
    }

    const response = await deduplicatedFetch(`${API_BASE_URL}/home`);
    if (!response.ok) {
      throw new Error('Failed to fetch home settings');
    }
    const data = await response.json();

    if (data.success) {
      cacheUtils.set(CACHE_KEYS.HOME, data);
    }

    return data;
  },

  _backgroundRefresh: async () => {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/home`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          cacheUtils.set(CACHE_KEYS.HOME, data);
        }
      }
    } catch (e) {
      // 무시
    }
  },

  // Home 설정 수정
  updateHome: async (homeData) => {
    const response = await fetch(`${API_BASE_URL}/home`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(homeData)
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to update home settings');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.HOME);
    return data;
  }
};

// VillageDiary API — 마을일기 편집 데이터 영속화 (싱글톤 오버라이드 객체)
//   백엔드를 단일 진실 소스로. get 은 raw 오버라이드 객체 { [programId]: DiaryCardData[] } 를 반환,
//   save 는 동일한 raw 객체를 PUT body 로 보낸다.
//
//   ── 꿈다락 전용 인증(사이트 관리자와 완전 분리) ──
//   · 사이트 세션은 'auth_token'/'auth_user' 키, getHeaders()/handle401() 를 사용한다.
//   · 꿈다락 편집은 별개 키 'kkumdarak_token' 만 사용하며 사이트 로그인/로그아웃과 무관하다.
//   · save() 는 getHeaders()/handle401() 를 절대 재사용하지 않는다(여기서 헤더를 직접 구성).
const KKUMDARAK_TOKEN_KEY = 'kkumdarak_token';

export const villageDiaryAPI = {
  // 오버라이드 조회 (공개) — mergePrograms 가 직접 소비하는 raw 객체 반환
  //   ⚠️ Vercel Edge Cache 우회(saengsanso 공개 GET 과 동일한 cdnBustUrl 패턴):
  //   GET 라우트가 Cache-Control s-maxage=60, stale-while-revalidate=300 을 보내므로
  //   저장(PUT)은 엣지 캐시를 무효화하지 못한다. 캐시버스터가 없으면 저장 직후 재진입 시
  //   엣지 캐시의 '저장 이전' 응답을 받아 편집값이 풀려버린다.
  //   → 저장 시 markCdnDirty 로 표식, 이후 5분 창에서만 ?_t= 로 우회(=저장 직후 재진입 구간).
  //     그 외 일반 방문자는 엣지 캐시를 그대로 활용해 공개 페이지 성능을 유지한다.
  get: async () => {
    const response = await fetchWithRetry(cdnBustUrl(`${API_BASE_URL}/village-diary`, 'village_diary_updated'));
    if (!response.ok) {
      throw new Error('Failed to fetch village diary');
    }
    const data = await response.json();
    // 백엔드 응답은 { success, data } — raw 오버라이드 객체는 data 안에 있다
    return data && data.success ? (data.data || {}) : {};
  },

  // 꿈다락 편집 토큰 헬퍼 (사이트 auth_token 과 완전히 별개 키)
  getKkumdarakToken: () => {
    try {
      return localStorage.getItem(KKUMDARAK_TOKEN_KEY);
    } catch (e) {
      return null;
    }
  },
  clearKkumdarakToken: () => {
    try {
      localStorage.removeItem(KKUMDARAK_TOKEN_KEY);
    } catch (e) {
      // ignore
    }
  },

  // 꿈다락 편집 로그인 — 단일 공유 비밀번호로 scope:'kkumdarak' 토큰 발급/저장
  //   성공 → kkumdarak_token 저장 후 true. 비밀번호 불일치(401) → false.
  //   미설정(500)/네트워크 등 그 외 오류 → throw.
  login: async (password) => {
    const response = await fetch(`${API_BASE_URL}/village-diary/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (response.status === 401) {
      return false; // 비밀번호 불일치
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `로그인 실패 (${response.status})`);
    }
    const data = await response.json();
    if (!data || !data.success || !data.token) {
      throw new Error('로그인 응답이 올바르지 않습니다.');
    }
    try {
      localStorage.setItem(KKUMDARAK_TOKEN_KEY, data.token);
    } catch (e) {
      // localStorage 사용 불가 — 토큰 메모리 유실되지만 로그인 자체는 성공으로 본다
    }
    return true;
  },

  // 오버라이드 저장 (꿈다락 편집 인증 전용) — raw 오버라이드 객체를 통째로 PUT
  //   Authorization 은 kkumdarak_token 으로 직접 구성한다(getHeaders 재사용 금지).
  //   401/403(만료·무효) → clearKkumdarakToken() 후 code 'KKUM_AUTH_EXPIRED' 로 throw.
  save: async (overrideData) => {
    const token = villageDiaryAPI.getKkumdarakToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/village-diary`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(overrideData)
    });
    if (response.status === 401 || response.status === 403) {
      villageDiaryAPI.clearKkumdarakToken();
      const err = new Error('꿈다락 인증이 만료되었습니다. 다시 로그인해주세요.');
      err.code = 'KKUM_AUTH_EXPIRED';
      throw err;
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to save village diary (${response.status})`);
    }
    // 저장 성공 — 이후 5분 동안 get()이 ?_t= 로 엣지 캐시를 우회하도록 표식(재진입 시 최신값 보장)
    markCdnDirty('village_diary_updated');
    return response.json();
  }
};


// KkumdarakSettings API — 꿈다락 공개 페이지 설정(프로그램 신청 링크/마감) 영속화
//   백엔드 단일 진실 소스. get 은 raw 설정 객체 { programs: { [name]: { applyUrl?, closed? } } } 반환,
//   save 는 동일한 raw 객체를 PUT body 로 보낸다.
//   인증은 마을일기와 동일한 꿈다락 전용 토큰(kkumdarak_token)을 그대로 재사용한다
//   (사이트 auth_token 과 완전 분리, getHeaders()/handle401() 재사용 금지).
export const kkumdarakSettingsAPI = {
  // 설정 조회 (공개) — Programs 가 직접 소비하는 raw 객체 반환(없으면 {})
  //   ⚠️ Vercel Edge Cache 우회(saengsanso 공개 GET 과 동일한 cdnBustUrl 패턴):
  //   GET 라우트가 Cache-Control s-maxage=60, stale-while-revalidate=300 을 보내므로
  //   저장(PUT)은 엣지 캐시를 무효화하지 못한다. 캐시버스터가 없으면 '모집 마감' 토글을
  //   저장한 직후 재진입/새로고침 시 엣지 캐시의 '저장 이전' 응답(closed:false)을 받아
  //   체크가 풀려버린다(=원래 버그). → 저장 시 markCdnDirty 로 표식, 이후 5분 창에서만 ?_t=
  //   로 우회(저장 직후 재진입 구간). 그 외 일반 방문자는 엣지 캐시를 그대로 활용한다.
  get: async () => {
    const response = await fetchWithRetry(cdnBustUrl(`${API_BASE_URL}/kkumdarak-settings`, 'kkum_settings_updated'));
    if (!response.ok) {
      throw new Error('Failed to fetch kkumdarak settings');
    }
    const data = await response.json();
    return data && data.success ? (data.data || {}) : {};
  },

  // 설정 저장 (꿈다락 편집 인증 전용) — raw 설정 객체를 통째로 PUT
  //   Authorization 은 kkumdarak_token 으로 직접 구성한다(getHeaders 재사용 금지).
  //   401/403(만료·무효) → clearKkumdarakToken() 후 code 'KKUM_AUTH_EXPIRED' 로 throw.
  save: async (settingsData) => {
    const token = villageDiaryAPI.getKkumdarakToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/kkumdarak-settings`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(settingsData)
    });
    if (response.status === 401 || response.status === 403) {
      villageDiaryAPI.clearKkumdarakToken();
      const err = new Error('꿈다락 인증이 만료되었습니다. 다시 로그인해주세요.');
      err.code = 'KKUM_AUTH_EXPIRED';
      throw err;
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to save kkumdarak settings (${response.status})`);
    }
    // 저장 성공 — 이후 5분 동안 get()이 ?_t= 로 엣지 캐시를 우회하도록 표식(재진입 시 최신값 보장)
    markCdnDirty('kkum_settings_updated');
    const data = await response.json();
    return data && data.success ? (data.data || {}) : {};
  }
};

// KkumdarakNewsStatus API — 「마을소식」 호(號)별 공개/준비중(draft) 상태 영속화
//   ⚠️ 새 컬렉션/스키마 없음. kkumdarak-settings 싱글톤의 Mixed `data` 에
//   newsStatus 버킷({ [issueId]: 'published' | 'draft' })을 추가로 얹는다(programContent 선례).
//   백엔드 PUT 은 data 통째 교체이므로, 다른 버킷(programs/programContent)을 보존하려면
//   반드시 '최신 GET 베이스에 newsStatus 만 머지'하는 read-merge-write 를 지켜야 한다
//   (Programs.tsx saveCore 의 dataRef read-merge-write 와 동일 불변식 — 머지 누락 시 타 버킷 소실).
//   인증/캐시버스팅은 kkumdarakSettingsAPI 와 동일(kkumdarak_token, markCdnDirty/cdnBustUrl).
export const kkumdarakNewsStatusAPI = {
  // 호별 상태 맵 조회 (공개) — { [issueId]: 'published' | 'draft' } 반환(없으면 {}).
  //   kkumdarakSettingsAPI.get() 이 내부적으로 cdnBustUrl 로 엣지 캐시를 우회한다
  //   (저장 직후 5분 창 한정 — 편집자 화면 즉시 신선값 보장).
  get: async () => {
    const settings = await kkumdarakSettingsAPI.get();
    const ns = settings && settings.newsStatus;
    return ns && typeof ns === 'object' ? ns : {};
  },

  // 호 상태 토글 저장 (꿈다락 편집 인증 전용) — read-merge-write.
  //   issueId 의 상태만 newsStatus 에 머지하고, 그 외 모든 버킷은 최신 GET 베이스 그대로 보존한다.
  //   newsStatus 안의 다른 호 상태도 보존(이번에 토글한 issueId 키만 교체).
  //   반환: 저장 후의 newsStatus 맵({ [issueId]: ... }).
  setIssueStatus: async (issueId, status) => {
    // ① 최신 베이스 GET — 다른 버킷/다른 호 상태를 보존하기 위한 머지 기준.
    const base = await kkumdarakSettingsAPI.get(); // { programs?, programContent?, newsStatus? }
    const baseNewsStatus =
      base && base.newsStatus && typeof base.newsStatus === 'object' ? base.newsStatus : {};

    // ② newsStatus 버킷에 이 호의 상태만 머지(다른 호 상태 유지).
    const nextNewsStatus = { ...baseNewsStatus, [issueId]: status };

    // ③ 전체 settings 객체를 통째로 PUT(타 버킷 보존). kkumdarakSettingsAPI.save 가
    //   401/403 → KKUM_AUTH_EXPIRED throw + markCdnDirty 까지 처리한다.
    const saved = await kkumdarakSettingsAPI.save({ ...base, newsStatus: nextNewsStatus });
    const savedNs = saved && saved.newsStatus && typeof saved.newsStatus === 'object'
      ? saved.newsStatus
      : nextNewsStatus;
    return savedNs;
  }
};

// VillageNews API — 「마을소식」 호(號) 편집 사본 영속화 (싱글톤 village_news 컬렉션)
//   백엔드를 단일 진실 소스로. get 은 raw 객체 { issues: { [id]: SerializedNewsIssue } } 를 반환,
//   save 는 동일한 raw 객체를 PUT body 로 보낸다. mergeIssues 가 정적 NEWS_ISSUES 와 병합한다.
//   인증/캐시버스팅은 kkumdarakSettingsAPI 와 동일(kkumdarak_token, markCdnDirty/cdnBustUrl,
//   401/403 → KKUM_AUTH_EXPIRED). 사이트 auth_token/getHeaders/handle401 는 절대 재사용하지 않는다.
export const villageNewsAPI = {
  // 편집 사본 조회 (공개) — mergeIssues 가 직접 소비하는 raw 객체 { issues } 반환(없으면 { issues: {} }).
  //   ⚠️ Vercel Edge Cache 우회: GET 라우트가 s-maxage=60 을 보내므로 PUT 은 엣지 캐시를
  //   무효화하지 못한다. 저장 시 markCdnDirty('village_news_updated') 로 표식, 이후 5분 창에서만
  //   ?_t= 로 우회(저장 직후 재진입 구간) — 그 외 방문자는 엣지 캐시를 그대로 활용해 성능 유지.
  get: async () => {
    const response = await fetchWithRetry(
      cdnBustUrl(`${API_BASE_URL}/village-news`, 'village_news_updated'),
    );
    if (!response.ok) {
      throw new Error('Failed to fetch village news');
    }
    const data = await response.json();
    const raw = data && data.success ? (data.data || {}) : {};
    // issues 버킷만 반환(없으면 빈 객체). 항상 { issues } 형태로 정규화.
    return { issues: raw.issues && typeof raw.issues === 'object' ? raw.issues : {} };
  },

  // 편집 사본 저장 (꿈다락 편집 인증 전용) — raw 객체 { issues } 를 통째로 PUT.
  //   ⚠️ 호출측(NewsEditor)이 read-merge-write 로 다른 호를 보존한 전체 issues 를 넘긴다.
  //   Authorization 은 kkumdarak_token 으로 직접 구성(getHeaders 재사용 금지).
  //   401/403(만료·무효) → clearKkumdarakToken() 후 code 'KKUM_AUTH_EXPIRED' 로 throw.
  save: async (payload) => {
    const token = villageDiaryAPI.getKkumdarakToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const issues = payload && payload.issues && typeof payload.issues === 'object' ? payload.issues : {};
    const response = await fetch(`${API_BASE_URL}/village-news`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ issues }),
    });
    if (response.status === 401 || response.status === 403) {
      villageDiaryAPI.clearKkumdarakToken();
      const err = new Error('꿈다락 인증이 만료되었습니다. 다시 로그인해주세요.');
      err.code = 'KKUM_AUTH_EXPIRED';
      throw err;
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to save village news (${response.status})`);
    }
    markCdnDirty('village_news_updated');
    const data = await response.json();
    const raw = data && data.success ? (data.data || {}) : {};
    return { issues: raw.issues && typeof raw.issues === 'object' ? raw.issues : {} };
  },
};

// Contact API
export const contactAPI = {
  // Contact 설정 조회
  getContact: async (options = {}) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh) {
      const cached = cacheUtils.get(CACHE_KEYS.CONTACT);
      if (cached) {
        console.log('Contact: 캐시에서 로드');
        return cached;
      }
    }

    const response = await fetchWithRetry(`${API_BASE_URL}/contact`);
    if (!response.ok) {
      throw new Error('Failed to fetch contact');
    }
    const data = await response.json();

    if (data.success) {
      cacheUtils.set(CACHE_KEYS.CONTACT, data);
    }

    return data;
  },

  // Contact 설정 수정
  updateContact: async (contactData) => {
    const response = await fetch(`${API_BASE_URL}/contact`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(contactData)
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to update contact');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.CONTACT);
    return data;
  },

  // 문의 메일 전송
  sendMessage: async (messageData) => {
    const response = await fetch(`${API_BASE_URL}/contact/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messageData)
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to send message');
    }
    return response.json();
  }
};

// Guestbook API
const GUESTBOOK_CACHE_KEY = 'cache_guestbook';

export const guestbookAPI = {
  // 모든 방명록 조회 (SWR 패턴 적용)
  getAll: async (options = {}) => {
    const { forceRefresh = false } = options;

    // 캐시 확인 (SWR 패턴)
    if (!forceRefresh) {
      const { data: cached, isStale } = cacheUtils.getWithStale(GUESTBOOK_CACHE_KEY);
      if (cached) {
        console.log(`Guestbook: 캐시에서 로드 (${isStale ? 'stale' : 'fresh'})`);
        // stale 데이터인 경우 백그라운드에서 갱신
        if (isStale) {
          guestbookAPI._backgroundRefresh();
        }
        return cached;
      }
    }

    const response = await deduplicatedFetch(`${API_BASE_URL}/guestbook`);
    if (!response.ok) {
      throw new Error('Failed to fetch guestbook entries');
    }
    const data = await response.json();

    // 성공 시 캐시 저장
    if (data.success) {
      cacheUtils.set(GUESTBOOK_CACHE_KEY, data);
    }

    return data;
  },

  // 백그라운드 갱신 (UI 블로킹 없이)
  _backgroundRefresh: async () => {
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/guestbook`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          cacheUtils.set(GUESTBOOK_CACHE_KEY, data);
          console.log('Guestbook: 백그라운드 갱신 완료');
        }
      }
    } catch (e) {
      console.log('Guestbook: 백그라운드 갱신 실패 (무시)');
    }
  },

  // 새 방명록 작성
  create: async (entryData) => {
    const response = await fetch(`${API_BASE_URL}/guestbook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(entryData)
    });
    if (!response.ok) {
      throw new Error('Failed to create guestbook entry');
    }
    const data = await response.json();
    // 캐시 무효화
    cacheUtils.remove(GUESTBOOK_CACHE_KEY);
    return data;
  },

  // 방명록 삭제 (관리자 전용)
  delete: async (id) => {
    const response = await fetch(`${API_BASE_URL}/guestbook/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to delete guestbook entry');
    }
    const data = await response.json();
    // 캐시 무효화
    cacheUtils.remove(GUESTBOOK_CACHE_KEY);
    return data;
  }
};

// Saengsanso API — 생산소 전용 CRUD
const ssoTypes = [
  { key: 'exhibitions', cacheKey: CACHE_KEYS.SSO_EXHIBITIONS },
  { key: 'projects', cacheKey: CACHE_KEYS.SSO_PROJECTS },
  { key: 'news', cacheKey: CACHE_KEYS.SSO_NEWS },
  { key: 'archive', cacheKey: CACHE_KEYS.SSO_ARCHIVES },
  { key: 'slides', cacheKey: 'cache_sso_slides' },
];

// CDN 캐시 버스팅 유틸: 최근 업데이트 후 5분 이내면 타임스탬프 쿼리 파라미터 추가
const cdnBustUrl = (baseUrl, storageKey) => {
  try {
    const ts = localStorage.getItem(storageKey);
    if (ts && (Date.now() - Number(ts)) < 5 * 60 * 1000) {
      return `${baseUrl}?_t=${ts}`;
    }
  } catch (e) { /* ignore */ }
  return baseUrl;
};
const markCdnDirty = (storageKey) => {
  try { localStorage.setItem(storageKey, String(Date.now())); } catch (e) { /* ignore */ }
};

export const saengsansoAboutAPI = {
  get: async () => {
    const url = cdnBustUrl(`${API_BASE_URL}/saengsanso/about-page`, 'sso_about_updated');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch saengsanso about');
    return response.json();
  },
  update: async (description) => {
    const response = await fetch(`${API_BASE_URL}/saengsanso/about-page`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ description }),
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to update saengsanso about');
    }
    const data = await response.json();
    markCdnDirty('sso_about_updated');
    return data;
  },
};

export const saengsansoMembersAPI = {
  get: async () => {
    const url = cdnBustUrl(`${API_BASE_URL}/saengsanso/members`, 'sso_members_updated');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch saengsanso members');
    return response.json();
  },
  update: async (members) => {
    const response = await fetch(`${API_BASE_URL}/saengsanso/members`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ members }),
    });
    if (!response.ok) {
      if (response.status === 401) return handle401();
      throw new Error('Failed to update saengsanso members');
    }
    const data = await response.json();
    markCdnDirty('sso_members_updated');
    return data;
  },
};

export const saengsansoAPI = {
  // 통합 API 1회 호출로 전체 데이터 로드
  // Render 콜드 스타트(~15-20초) 대응: 1회 시도, 25초 타임아웃
  loadAll: async () => {
    const response = await fetchWithRetry(`${API_BASE_URL}/saengsanso/all`, {}, 1, 25000);
    if (!response.ok) throw new Error('Failed to fetch saengsanso/all');
    const data = await response.json();
    if (data.success) {
      if (data.exhibitions) cacheUtils.set(CACHE_KEYS.SSO_EXHIBITIONS, data.exhibitions);
      if (data.projects) cacheUtils.set(CACHE_KEYS.SSO_PROJECTS, data.projects);
      if (data.news) cacheUtils.set(CACHE_KEYS.SSO_NEWS, data.news);
      if (data.archive) cacheUtils.set(CACHE_KEYS.SSO_ARCHIVES, data.archive);
      if (data.slides) cacheUtils.set('cache_sso_slides', data.slides);
    }
    return data;
  },
};

ssoTypes.forEach(({ key, cacheKey }) => {
  saengsansoAPI[key] = {
    getAll: async (options = {}) => {
      const { forceRefresh = false } = options;
      if (!forceRefresh) {
        const { data: cached, isStale } = cacheUtils.getWithStale(cacheKey);
        if (cached) {
          if (isStale) {
            // 백그라운드에서 조용히 갱신
            deduplicatedFetch(`${API_BASE_URL}/saengsanso/${key}`)
              .then(r => r.json())
              .then(d => { if (d.success) cacheUtils.set(cacheKey, d); })
              .catch(() => {});
          }
          return cached; // 캐시 즉시 반환
        }
      }
      // forceRefresh=true 시 ?_t= 쿼리로 Vercel Edge Cache도 우회
      const url = forceRefresh
        ? `${API_BASE_URL}/saengsanso/${key}?_t=${Date.now()}`
        : `${API_BASE_URL}/saengsanso/${key}`;
      const response = await deduplicatedFetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${key}`);
      const data = await response.json();
      if (data.success) cacheUtils.set(cacheKey, data);
      return data;
    },
    create: async (itemData) => {
      const response = await fetch(`${API_BASE_URL}/saengsanso/${key}`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(itemData)
      });
      if (!response.ok) {
        if (response.status === 401) return handle401();
        const errBody = await response.json().catch(() => ({}));
        console.error(`SSO ${key} create 오류:`, response.status, errBody);
        throw new Error(errBody.error || errBody.message || `Failed to create ${key}`);
      }
      const data = await response.json();
      cacheUtils.remove(cacheKey);
      return data;
    },
    update: async (id, itemData) => {
      const response = await fetch(`${API_BASE_URL}/saengsanso/${key}/${id}`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify(itemData)
      });
      if (!response.ok) {
        if (response.status === 401) return handle401();
        throw new Error(`Failed to update ${key}`);
      }
      const data = await response.json();
      cacheUtils.remove(cacheKey);
      return data;
    },
    delete: async (id) => {
      const response = await fetch(`${API_BASE_URL}/saengsanso/${key}/${id}`, {
        method: 'DELETE', headers: getHeaders()
      });
      if (!response.ok) {
        if (response.status === 401) return handle401();
        throw new Error(`Failed to delete ${key}`);
      }
      const data = await response.json();
      cacheUtils.remove(cacheKey);
      return data;
    },
    reorder: async (orders) => {
      const response = await fetch(`${API_BASE_URL}/saengsanso/${key}/reorder`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ orders })
      });
      if (!response.ok) {
        if (response.status === 401) return handle401();
        throw new Error(`Failed to reorder ${key}`);
      }
      const data = await response.json();
      cacheUtils.remove(cacheKey);
      return data;
    },
  };
});

const api = {
  work: workAPI,
  filed: filedAPI,
  about: aboutAPI
};

// [async-parallel] 프리페칭 유틸리티 - 페이지 진입 전 데이터 미리 로드
export const prefetchAPI = {
  // 홈페이지 데이터 프리페치
  home: () => {
    homeAPI.getHome().catch(() => {});
  },

  // Work 페이지 데이터 프리페치
  work: () => {
    Promise.all([
      workAPI.getAllPosts(),
      workAPI.getWorkHeader()
    ]).catch(() => {});
  },

  // Filed 페이지 데이터 프리페치
  filed: () => {
    Promise.all([
      filedAPI.getAllPosts(),
      filedAPI.getFiledHeader()
    ]).catch(() => {});
  },

  // About 페이지 데이터 프리페치
  about: () => {
    aboutAPI.getAbout().catch(() => {});
  },

  // CV 페이지 데이터 프리페치
  cv: () => {
    cvAPI.getCV().catch(() => {});
  },

  // Guestbook 페이지 데이터 프리페치
  guestbook: () => {
    guestbookAPI.getAll().catch(() => {});
  },

  // 자주 방문하는 페이지 데이터를 통합 API 1회 호출로 프리페치
  critical: async () => {
    try {
      const response = await deduplicatedFetch(`${API_BASE_URL}/home/all`);
      if (!response.ok) throw new Error('Failed to fetch home/all');
      const data = await response.json();
      if (data.success) {
        if (data.home) cacheUtils.set(CACHE_KEYS.HOME, data.home);
        if (data.works) cacheUtils.set(CACHE_KEYS.WORK_POSTS, data.works);
        if (data.filed) cacheUtils.set(CACHE_KEYS.FILED_POSTS, data.filed);
        if (data.about) cacheUtils.set(CACHE_KEYS.ABOUT, data.about);
      }
    } catch (e) {
      // 통합 API 실패 시 개별 호출로 폴백
      Promise.all([
        homeAPI.getHome(),
        workAPI.getAllPosts(),
        filedAPI.getAllPosts(),
        aboutAPI.getAbout()
      ]).catch(() => {});
    }
  }
};

export const utilAPI = {
  fetchMetadata: (url) => api.get(`/util/fetch-metadata?url=${encodeURIComponent(url)}`),
};

export default api;
