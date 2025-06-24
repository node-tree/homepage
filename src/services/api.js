// nodetree.kr 배포 환경 감지
const isNodeTreeSite = typeof window !== 'undefined' && 
  (window.location.hostname === 'nodetree.kr' || window.location.hostname === 'www.nodetree.kr');

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (isNodeTreeSite ? 'https://www.nodetree.kr/api' : 
   process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

// 추가된 디버깅 코드
console.log('Current API_BASE_URL:', API_BASE_URL);
console.log('process.env.NODE_ENV:', process.env.NODE_ENV);
console.log('isNodeTreeSite:', isNodeTreeSite);

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

// Work API
export const workAPI = {
  // 모든 글 조회
  getAllPosts: async () => {
    const response = await fetch(`${API_BASE_URL}/work`);
    if (!response.ok) {
      throw new Error('Failed to fetch posts');
    }
    return response.json();
  },

  // 새 글 작성
  createPost: async (postData) => {
    const response = await fetch(`${API_BASE_URL}/work`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(postData)
    });
    if (!response.ok) {
      throw new Error('Failed to create post');
    }
    return response.json();
  },

  // 글 수정
  updatePost: async (id, postData) => {
    const response = await fetch(`${API_BASE_URL}/work/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(postData)
    });
    if (!response.ok) {
      throw new Error('Failed to update post');
    }
    return response.json();
  },

  // 글 삭제
  deletePost: async (id) => {
    const response = await fetch(`${API_BASE_URL}/work/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) {
      throw new Error('Failed to delete post');
    }
    return response.json();
  },

  // 상단 제목/부제목 단일 데이터 조회
  getWorkHeader: async () => {
    const response = await fetch(`${API_BASE_URL}/work/header`);
    if (!response.ok) {
      throw new Error('Failed to fetch work header');
    }
    return response.json();
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
    return response.json();
  }
};

// Filed API
export const filedAPI = {
  // 모든 기록 조회
  getAllPosts: async () => {
    const response = await fetch(`${API_BASE_URL}/filed`);
    if (!response.ok) {
      throw new Error('Failed to fetch posts');
    }
    return response.json();
  },

  // 새 기록 작성
  createPost: async (postData) => {
    const response = await fetch(`${API_BASE_URL}/filed`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(postData)
    });
    if (!response.ok) {
      throw new Error('Failed to create post');
    }
    return response.json();
  },

  // 기록 수정
  updatePost: async (id, postData) => {
    const response = await fetch(`${API_BASE_URL}/filed/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(postData)
    });
    if (!response.ok) {
      throw new Error('Failed to update post');
    }
    return response.json();
  },

  // 기록 삭제
  deletePost: async (id) => {
    const response = await fetch(`${API_BASE_URL}/filed/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    if (!response.ok) {
      throw new Error('Failed to delete post');
    }
    return response.json();
  },

  // 상단 제목/부제목 단일 데이터 조회
  getFiledHeader: async () => {
    const response = await fetch(`${API_BASE_URL}/filed/header`);
    if (!response.ok) {
      throw new Error('Failed to fetch filed header');
    }
    return response.json();
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
    return response.json();
  }
};

// About API
export const aboutAPI = {
  getAbout: async () => {
    const response = await fetch(`${API_BASE_URL}/about`);
    if (!response.ok) {
      throw new Error('Failed to fetch about content');
    }
    return response.json();
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
    return response.json();
  }
};

// CV API
export const cvAPI = {
  getCV: async () => {
    const response = await fetch(`${API_BASE_URL}/cv`);
    if (!response.ok) {
      throw new Error('Failed to fetch CV');
    }
    return response.json();
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
    return response.json();
  }
};

// Location API (단일 데이터)
export const locationAPI = {
  getLocation: async () => {
    const response = await fetch(`${API_BASE_URL}/location-video`);
    if (!response.ok) {
      throw new Error('Failed to fetch location');
    }
    return response.json();
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
    return response.json();
  },
  getLocationHeader: async () => {
    const response = await fetch(`${API_BASE_URL}/location-video/header`);
    if (!response.ok) throw new Error('Failed to fetch location header');
    return response.json();
  },
  updateLocationHeader: async (headerData) => {
    const response = await fetch(`${API_BASE_URL}/location-video/header`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(headerData)
    });
    if (!response.ok) throw new Error('Failed to update location header');
    return response.json();
  }
};

export const humanAPI = {
  getHumanHeader: async () => {
    const response = await fetch(`${API_BASE_URL}/human/header`);
    if (!response.ok) {
      throw new Error('Failed to fetch human header');
    }
    return response.json();
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
    return response.json();
  }
};

const api = {
  work: workAPI,
  filed: filedAPI,
  about: aboutAPI
};

export const utilAPI = {
  fetchMetadata: (url) => api.get(`/util/fetch-metadata?url=${encodeURIComponent(url)}`),
};

export default api;
