import { http } from "@/shared/lib/index.js";

export interface Client {
  id: string;
  name: string;
  /** Contact-book details. Every one is optional on the server. */
  fullName: string | null;
  organization: string | null;
  unp: string | null;
  phone: string | null;
  telegram: string | null;
  email: string | null;
  website: string | null;
  /** The picture itself, as a `data:` URL — or null when none is set. */
  image: string | null;
  /** The generator's settings, or `{"source":"upload"}` for an uploaded logo. */
  avatarPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientInput {
  name: string;
  /** `null` clears a stored value; omitting the key leaves it alone. */
  fullName?: string | null;
  organization?: string | null;
  unp?: string | null;
  phone?: string | null;
  telegram?: string | null;
  email?: string | null;
  website?: string | null;
}

export const clientsApi = {
  list: () => http.get<Client[]>("/clients"),
  create: (body: ClientInput) => http.post<Client>("/clients", body),
  update: (id: string, body: ClientInput) => http.patch<Client>(`/clients/${id}`, body),
  remove: (id: string) => http.del(`/clients/${id}`),
  saveAvatar: (id: string, png: Blob, avatarPath: string) => {
    const form = new FormData();
    form.append("image", png, "avatar.png");
    form.append("avatarPath", avatarPath);
    return http.putForm<Client>(`/clients/${id}/avatar`, form);
  },
};
