import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("workledger_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const request = async (promise) => {
  try {
    return (await promise).data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message || "Unable to complete that request.",
    );
  }
};

export default api;
