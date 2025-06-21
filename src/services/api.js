// nodetree.kr 배포 환경 감지
const isNodeTreeSite = typeof window !== 'undefined' && 
  (window.location.hostname === 'nodetree.kr' || window.location.hostname === 'www.nodetree.kr');

const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (isNodeTreeSite ? 'https://nodetree.kr/api' : 
   process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:8000/api');

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
  }
};

const api = {
  work: workAPI,
  filed: filedAPI
};

export default api; 