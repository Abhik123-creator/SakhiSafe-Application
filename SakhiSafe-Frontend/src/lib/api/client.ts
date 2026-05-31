"use client";

import axios from "axios";

import { useAuthStore } from "@/stores/auth/auth-store";

import type { ApiEnvelope } from "./types";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error?.message ?? error.message ?? "Request failed";
    return Promise.reject(new Error(message));
  },
);

export async function apiGet<T>(url: string): Promise<T> {
  const response = await apiClient.get<ApiEnvelope<T>>(url);
  return response.data.data;
}

export async function apiPost<T, TBody = unknown>(url: string, body: TBody): Promise<T> {
  const response = await apiClient.post<ApiEnvelope<T>>(url, body);
  return response.data.data;
}

export async function apiPatch<T, TBody = unknown>(url: string, body?: TBody): Promise<T> {
  const response = await apiClient.patch<ApiEnvelope<T>>(url, body);
  return response.data.data;
}

export async function apiPut<T, TBody = unknown>(url: string, body: TBody): Promise<T> {
  const response = await apiClient.put<ApiEnvelope<T>>(url, body);
  return response.data.data;
}
