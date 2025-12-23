import axios from "axios";
import type { AxiosResponse } from "axios";

const api = axios.create({
  // Point to the FastAPI routes (they are mounted under /api)
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
});

type Credentials = { username: string; password: string };
export type TaskStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILURE";

export type TaskStatusResponse = {
  id: string;
  status: TaskStatus;
  result: string | null;
};
export type TaskListItem = TaskStatusResponse;

const toFormPayload = (data: Credentials) => {
  const formData = new URLSearchParams();
  formData.append("username", data.username);
  formData.append("password", data.password);
  return formData;
};

export const registerUser = (data: Credentials) => api.post("/auth/register", toFormPayload(data));

export const loginUser = (data: Credentials) => api.post("/auth/token", toFormPayload(data));

export const transcribeFile = (file: File, token: string) => {
  const formData = new FormData();
  formData.append("file", file);
  // Backend expects a language form field; default to auto-detect if none chosen
  formData.append("language", "auto");

  return api.post("/transcribe", formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "multipart/form-data",
    },
  });
};

export const getTaskStatus = (
  taskId: string,
  token: string
): Promise<AxiosResponse<TaskStatusResponse>> => {
  return api.get(`/status/${taskId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const getTasks = (token: string): Promise<AxiosResponse<TaskListItem[]>> => {
  return api.get("/tasks", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export default api;
