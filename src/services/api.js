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
      const cached = sessionStorage.getItem(key);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const isExpired = Date.now() - timestamp > CACHE_DURATION;

      if (isExpired) {
        sessionStorage.removeItem(key);
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
      const cached = sessionStorage.getItem(key);
      if (!cached) return { data: null, isStale: false };

      const { data, timestamp } = JSON.parse(cached);
      const age = Date.now() - timestamp;
      const isStale = age > CACHE_DURATION;
      const isTooOld = age > STALE_DURATION;

      if (isTooOld) {
        sessionStorage.removeItem(key);
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
      sessionStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      // sessionStorage 용량 초과 시 기존 캐시 정리
      try {
        sessionStorage.clear();
        sessionStorage.setItem(key, JSON.stringify({
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
      sessionStorage.removeItem(key);
    } catch (e) {
      // ignore
    }
  },

  // 특정 prefix로 시작하는 캐시 모두 삭제
  clearByPrefix: (prefix) => {
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          sessionStorage.removeItem(key);
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
  LOCATION: 'cache_location',
  LOCATION_HEADER: 'cache_location_header',
  HUMAN_HEADER: 'cache_human_header',
  CONTACT: 'cache_contact',
  HOME: 'cache_home'
};

// 토큰을 가져오는 헬퍼 함수
const getAuthToken = () => {
  return localStorage.getItem('auth_token');
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

    const response = await deduplicatedFetch(`${API_BASE_URL}/work`);
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
      console.error('Work createPost 오류:', response.status, errorData);
      throw new Error(errorData.message || `Failed to create post (${response.status})`);
    }
    const data = await response.json();
    // 캐시 무효화
    cacheUtils.remove(CACHE_KEYS.WORK_POSTS);
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
      const errorData = await response.json().catch(() => ({}));
      console.error('Work updatePost 오류:', response.status, errorData);
      throw new Error(errorData.message || `Failed to update post (${response.status})`);
    }
    const data = await response.json();
    // 캐시 무효화
    cacheUtils.remove(CACHE_KEYS.WORK_POSTS);
    return data;
  },

  // 글 삭제
  deletePost: async (id) => {
    const response = await fetch(`${API_BASE_URL}/work/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Work deletePost 오류:', response.status, errorData);
      throw new Error(errorData.message || `Failed to delete post (${response.status})`);
    }
    const data = await response.json();
    // 캐시 무효화
    cacheUtils.remove(CACHE_KEYS.WORK_POSTS);
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
      throw new Error('Failed to update work header');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.WORK_HEADER);
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
      throw new Error('Failed to reorder posts');
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
      throw new Error('Failed to reorder posts');
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
      throw new Error('Failed to update CV');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.CV);
    return data;
  }
};

// Location API (단일 데이터)
export const locationAPI = {
  getLocation: async (options = {}) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh) {
      const cached = cacheUtils.get(CACHE_KEYS.LOCATION);
      if (cached) {
        console.log('Location: 캐시에서 로드');
        return cached;
      }
    }

    const response = await fetchWithRetry(`${API_BASE_URL}/location-video`);
    if (!response.ok) {
      throw new Error('Failed to fetch location');
    }
    const data = await response.json();

    if (data.success) {
      cacheUtils.set(CACHE_KEYS.LOCATION, data);
    }

    return data;
  },
  // 특정 도시 데이터 조회
  getCityData: async (cityName, options = {}) => {
    const { forceRefresh = false } = options;
    const cacheKey = `${CACHE_KEYS.LOCATION}_city_${cityName}`;

    if (!forceRefresh) {
      const cached = cacheUtils.get(cacheKey);
      if (cached) {
        console.log(`Location city (${cityName}): 캐시에서 로드`);
        return cached;
      }
    }

    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/location-video/${encodeURIComponent(cityName)}`);
      if (!response.ok) {
        // 404 등의 경우 기본 데이터 반환
        return { success: true, data: null };
      }
      const data = await response.json();

      if (data.success) {
        cacheUtils.set(cacheKey, data);
      }

      return data;
    } catch (error) {
      console.log(`도시 데이터 로드 실패 (${cityName}):`, error.message);
      // 에러 시 기본 데이터 반환 (페이지는 정상 로드)
      return { success: true, data: null };
    }
  },
  updateLocation: async (locationData) => {
    const response = await fetch(`${API_BASE_URL}/location-video`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(locationData)
    });
    if (!response.ok) {
      throw new Error('Failed to update location');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.LOCATION);
    return data;
  },
  getLocationHeader: async (options = {}) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh) {
      const cached = cacheUtils.get(CACHE_KEYS.LOCATION_HEADER);
      if (cached) {
        console.log('Location header: 캐시에서 로드');
        return cached;
      }
    }

    const response = await fetchWithRetry(`${API_BASE_URL}/location-video/header`);
    if (!response.ok) throw new Error('Failed to fetch location header');
    const data = await response.json();

    if (data.success) {
      cacheUtils.set(CACHE_KEYS.LOCATION_HEADER, data);
    }

    return data;
  },
  updateLocationHeader: async (headerData) => {
    const response = await fetch(`${API_BASE_URL}/location-video/header`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(headerData)
    });
    if (!response.ok) throw new Error('Failed to update location header');
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.LOCATION_HEADER);
    return data;
  }
};

// Location Posts API (글 목록 시스템)
export const locationPostAPI = {
  // 모든 글 조회 (캐시 우선)
  getAllPosts: async (options = {}) => {
    const { forceRefresh = false } = options;
    const cacheKey = 'cache_location_posts';

    if (!forceRefresh) {
      const cached = cacheUtils.get(cacheKey);
      if (cached) {
        console.log('Location posts: 캐시에서 로드');
        return cached;
      }
    }

    const response = await fetchWithRetry(`${API_BASE_URL}/location`);
    if (!response.ok) {
      throw new Error('Failed to fetch location posts');
    }
    const data = await response.json();

    if (data.success) {
      cacheUtils.set(cacheKey, data);
    }

    return data;
  },

  // 특정 글 조회
  getPost: async (id) => {
    const response = await fetchWithRetry(`${API_BASE_URL}/location/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch location post');
    }
    return response.json();
  },

  // 새 글 작성
  createPost: async (postData) => {
    const response = await fetch(`${API_BASE_URL}/location`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(postData)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Location createPost 오류:', response.status, errorData);
      throw new Error(errorData.message || `Failed to create location post (${response.status})`);
    }
    const data = await response.json();
    cacheUtils.remove('cache_location_posts');
    return data;
  },

  // 글 수정
  updatePost: async (id, postData) => {
    const response = await fetch(`${API_BASE_URL}/location/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(postData)
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Location updatePost 오류:', response.status, errorData);
      throw new Error(errorData.message || `Failed to update location post (${response.status})`);
    }
    const data = await response.json();
    cacheUtils.remove('cache_location_posts');
    return data;
  },

  // 글 삭제
  deletePost: async (id) => {
    const response = await fetch(`${API_BASE_URL}/location/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Location deletePost 오류:', response.status, errorData);
      throw new Error(errorData.message || `Failed to delete location post (${response.status})`);
    }
    const data = await response.json();
    cacheUtils.remove('cache_location_posts');
    return data;
  },

  // 상단 제목/부제목 조회 (기존 locationAPI.getLocationHeader 사용)
  getHeader: async (options = {}) => {
    const { forceRefresh = false } = options;

    if (!forceRefresh) {
      const cached = cacheUtils.get(CACHE_KEYS.LOCATION_HEADER);
      if (cached) {
        console.log('Location header: 캐시에서 로드');
        return cached;
      }
    }

    const response = await fetchWithRetry(`${API_BASE_URL}/location/header`);
    if (!response.ok) throw new Error('Failed to fetch location header');
    const data = await response.json();

    if (data.success) {
      cacheUtils.set(CACHE_KEYS.LOCATION_HEADER, data);
    }

    return data;
  },

  // 상단 제목/부제목 수정
  updateHeader: async (headerData) => {
    const response = await fetch(`${API_BASE_URL}/location/header`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(headerData)
    });
    if (!response.ok) throw new Error('Failed to update location header');
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.LOCATION_HEADER);
    return data;
  },

  // 글 순서 변경
  reorderPosts: async (orders) => {
    const response = await fetch(`${API_BASE_URL}/location/reorder`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ orders })
    });
    if (!response.ok) {
      throw new Error('Failed to reorder location posts');
    }
    const data = await response.json();
    cacheUtils.remove('cache_location_posts');
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
      throw new Error('Failed to update home settings');
    }
    const data = await response.json();
    cacheUtils.remove(CACHE_KEYS.HOME);
    return data;
  }
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
      throw new Error('Failed to delete guestbook entry');
    }
    const data = await response.json();
    // 캐시 무효화
    cacheUtils.remove(GUESTBOOK_CACHE_KEY);
    return data;
  }
};

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

  // Location 페이지 데이터 프리페치
  location: () => {
    Promise.all([
      locationPostAPI.getAllPosts(),
      locationPostAPI.getHeader()
    ]).catch(() => {});
  },

  // Guestbook 페이지 데이터 프리페치
  guestbook: () => {
    guestbookAPI.getAll().catch(() => {});
  },

  // 자주 방문하는 페이지 데이터를 병렬로 프리페치
  critical: () => {
    Promise.all([
      homeAPI.getHome(),
      workAPI.getAllPosts(),
      filedAPI.getAllPosts(),
      aboutAPI.getAbout()
    ]).catch(() => {});
  }
};

export const utilAPI = {
  fetchMetadata: (url) => api.get(`/util/fetch-metadata?url=${encodeURIComponent(url)}`),
};

export default api;
