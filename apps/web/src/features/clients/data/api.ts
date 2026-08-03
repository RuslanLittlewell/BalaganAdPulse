import { http } from "../../../lib/http.js";

export interface Client {
  id: string;
  name: string;
  niche: string | null;
  monthlyBudget: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientInput {
  name: string;
  niche?: string;
  monthlyBudget?: number;
  email?: string;
}

export const clientsApi = {
  list: () => http.get<Client[]>("/clients"),
  create: (body: ClientInput) => http.post<Client>("/clients", body),
  update: (id: string, body: ClientInput) => http.patch<Client>(`/clients/${id}`, body),
  remove: (id: string) => http.del(`/clients/${id}`),
};
