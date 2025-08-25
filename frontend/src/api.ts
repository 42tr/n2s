const API_BASE_URL = '/api';

export const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

export const createAuthHeaders = () => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      ...createAuthHeaders(),
      ...options.headers,
    },
  });

  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('username');
    window.location.reload();
    throw new Error('Authentication failed');
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response;
};