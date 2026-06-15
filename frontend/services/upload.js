const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

import { getToken } from "./auth";

export async function uploadVideo({ file, sport, plan = "free" }) {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sport", sport);
    formData.append("plan", plan);

    const res = await fetch(`${API_URL}/api/upload`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}
