import { api } from "@/shared/api/apiClient";

// ChatbotController (api/chatbot): pure API calls, no mapping or logic. Each one returns the payload of the server's response.
export const sendMessage = (body) => api.post("/chatbot/messages", body).then((res) => res?.data?.data);
export const suggestions = (params) => api.get("/chatbot/suggestions", { params }).then((res) => res?.data?.data);
