import { api } from "@/shared/api/apiClient";

// RegisterAccountsController (api/access/register-accounts): pure API calls.
const data = (res) => res?.data?.data;
const body = (res) => res.data;
const account = (userType, empNo) => `/access/register-accounts/${encodeURIComponent(userType)}/${encodeURIComponent(empNo)}`;

export const getAccounts = (params) => api.get("/access/register-accounts", { params }).then(data);
export const getCandidates = (params) => api.get("/access/register-accounts/candidates", { params }).then(data);
export const register = (newAccount) => api.post("/access/register-accounts", newAccount).then(body);
export const sendResetLink = (userType, empNo) => api.post(`${account(userType, empNo)}/reset-link`).then(body);
export const setActive = (userType, empNo, change) => api.patch(account(userType, empNo), change).then(body);