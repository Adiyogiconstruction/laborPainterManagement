import axios from "axios";

const apiUrl = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: apiUrl,
  timeout: 8000,
  withCredentials: true,
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
