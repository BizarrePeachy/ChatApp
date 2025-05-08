// src/api.ts
import axios from "axios";

// Determine the base URL based on the environment
const baseURL = "http://localhost:5000";

const api = axios.create({
  baseURL,
  withCredentials: true, // Send cookies with requests (for session management)
});

// Request interceptor for adding Authorization header if needed (e.g., for Bearer tokens)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("authToken"); // Or get from cookies if not httpOnly
    if (token && !config.headers["Authorization"]) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for handling errors globally (e.g., unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Handle unauthorized errors (e.g., redirect to login)
      console.error("Unauthorized access:", error);
      // Optionally: Redirect to login page using history.push('/login') if you have access to it here
      // Or dispatch an action to update authentication state
    }
    return Promise.reject(error);
  },
);

// Authentication Endpoints
export const login = (credentials: { username: string; password: string }) => {
  return api.post("/users/login", credentials);
};

export const register = (userData: { username: string; password: string }) => {
  return api.post("/api/users/register", userData);
};

// Server Endpoints
export const getServers = () => {
  return api.get("/api/servers");
};

export const createServer = (name: string) => {
  return api.post("/api/servers", { name });
};

export const deleteServer = (serverId: number) => {
  return api.delete(`/api/servers/${serverId}`);
};

// Channel Endpoints
export const getChannels = (serverId: number) => {
  return api.get(`/api/servers/${serverId}/channels`);
};

export const createChannel = (serverId: number, name: string) => {
  return api.post(`/api/servers/${serverId}/channels`, { name });
};

export const deleteChannel = (serverId: number, channelId: number) => {
  return api.delete(`/api/servers/${serverId}/channels/${channelId}`);
};

// Message Endpoints
export const getMessages = (serverId: number, channelId: number) => {
  return api.get(`/api/servers/${serverId}/channels/${channelId}/messages`);
};

export const getUserbyId = (userID: number) => {
  return api.get(`/users/username/${userID}`);
};

export const sendMessage = (
  serverId: number,
  channelId: number,
  content: string,
) => {
  return api.post(`/api/servers/${serverId}/channels/${channelId}/messages`, {
    content,
  });
};

// You can add more API functions here as needed

export default api;
