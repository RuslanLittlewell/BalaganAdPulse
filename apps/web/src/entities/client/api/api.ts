import { http } from "@/shared/lib/index.js";

export interface Client {
  id: string;
  name: string;
  fullName: string | null;
  organization: string | null;
  unp: string | null;
  phone: string | null;
  telegram: string | null;
  email: string | null;
  website: string | null;
  image: string | null;
  avatarPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientInput {
  name: string;
  fullName?: string | null;
  organization?: string | null;
  unp?: string | null;
  phone?: string | null;
  telegram?: string | null;
  email?: string | null;
  website?: string | null;
}

export interface ClientCredentials {
  login: string;
  password: string | null;
  createdAt: string;
}

export const clientsApi = {
  list: () => http.get<Client[]>("/clients"),
  create: (body: ClientInput) => http.post<Client>("/clients", body),
  update: (id: string, body: ClientInput) => http.patch<Client>(`/clients/${id}`, body),
  remove: (id: string) => http.del(`/clients/${id}`),
  account: (id: string) => http.get<ClientCredentials | null>(`/clients/${id}/account`),
  createAccount: (id: string) => http.post<ClientCredentials>(`/clients/${id}/account`, {}),
  reissuePassword: (id: string) => http.post<ClientCredentials>(`/clients/${id}/account/password`, {}),
  saveAvatar: (id: string, png: Blob, avatarPath: string) => {
    const form = new FormData();
    form.append("image", png, "avatar.png");
    form.append("avatarPath", avatarPath);
    return http.putForm<Client>(`/clients/${id}/avatar`, form);
  },
};
