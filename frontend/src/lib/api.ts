import axios from "axios";
import type { AxiosResponse } from "axios";

const api = axios.create({
  // Point to the FastAPI routes (they are mounted under /api)
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
});

type Credentials = { email: string; password: string };
export type TaskStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILURE";
export type AuthResponse = { access_token: string; token_type: string };
export type GithubAuthInfo = { authorization_url: string; state: string };

export type TaskStatusResponse = {
  id: string;
  status: TaskStatus;
  result: string | null;
};
export type TaskListItem = TaskStatusResponse & { created_at: string };

const toFormPayload = (data: Credentials) => {
  const formData = new URLSearchParams();
  formData.append("email", data.email);
  formData.append("password", data.password);
  return formData;
};

export const registerUser = (data: Credentials) =>
  api.post<AuthResponse>("/auth/register", toFormPayload(data));

export const loginUser = (data: Credentials) =>
  api.post<AuthResponse>("/auth/token", toFormPayload(data));

export const startGithubLogin = () =>
  api.get<GithubAuthInfo>("/auth/github/login");

export const completeGithubLogin = (params: { code: string; state: string }) =>
  api.get<AuthResponse>("/auth/github/callback", { params });

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

export const deleteTask = (taskId: string, token: string) => {
  return api.delete(`/tasks/${taskId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export default api;
