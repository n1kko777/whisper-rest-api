import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
});

export const registerUser = (data: any) => {
  return api.post("/register", data);
};

export const loginUser = (data: any) => {
  return api.post("/token", data);
};

export const transcribeFile = (file: File, token: string) => {
  const formData = new FormData();
  formData.append("file", file);

  return api.post("/transcribe", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
};

export const getTaskStatus = (taskId: number, token: string) => {
  return api.get(`/status/${taskId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};


export default api;
