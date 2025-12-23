import axios from "axios";

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;

    if (data?.detail) {
      const { detail } = data;

      if (typeof detail === "string") {
        return detail;
      }

      if (Array.isArray(detail)) {
        const first = detail[0];

        if (typeof first === "string") {
          return first;
        }

        if (first?.msg) {
          return first.msg;
        }
      }
    }

    if (typeof data?.message === "string") {
      return data.message;
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unexpected error. Please try again.";
}
