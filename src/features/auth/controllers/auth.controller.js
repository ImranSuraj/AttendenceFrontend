import { api } from "@/shared/api/apiClient";

// AuthController (api/auth): pure API calls. None sends a token (nobody has a session yet), and all pass
// skipErrorToast so the login page shows the message itself. Each returns the raw response, read by the service.
const quiet = { skipErrorToast: true };

export const getPublicKey = () => api.get("/auth/public-key", quiet);
export const createSession = (body) => api.post("/auth/sessions", body, quiet);
export const verifyMfa = (body) => api.post("/auth/mfa-verifications", body, quiet);
export const requestPasswordReset = (body) => api.post("/auth/password-reset-requests", body, quiet);
export const resetPassword = (body) => api.post("/auth/password-resets", body, quiet);
export const createTeamsSession = (body) => api.post("/auth/teams-sessions", body, quiet);