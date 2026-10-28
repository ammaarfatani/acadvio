import { apiFetch } from "./api";
// Short-lived, bounded, session-and-branch-specific in-flight cache. Never persist photos.
const images = new Map<string, { at: number; value: Promise<string> }>();
export function profilePhoto(
  person: any,
  kind: "student" | "staff" = "student",
): Promise<string> {
  if (typeof window === "undefined") return Promise.resolve("");
  if (kind === "student" && person?.photoUrl === "") return Promise.resolve("");
  const id = person?._id || person?.studentId;
  const url = person?.photoUrl;
  if (kind === "student" && /^https?:\/\//.test(url || ""))
    return Promise.resolve(url);
  if (kind === "staff" && person?.idPhoto?.startsWith("data:image/"))
    return Promise.resolve(person.idPhoto);
  const endpoint =
    kind === "staff"
      ? id && /^[a-f0-9]{24}$/i.test(String(id))
        ? `/student-media/staff/${id}/photo`
        : ""
      : url?.startsWith("/student-media/")
        ? url
        : id && /^[a-f0-9]{24}$/i.test(String(id))
          ? `/student-media/${id}/photo`
          : "";
  if (!endpoint)
    return Promise.resolve(/^https?:\/\//.test(url || "") ? url : "");
  const key = [
    localStorage.getItem("acadivo_access_token"),
    sessionStorage.getItem("acadivo:branch"),
    endpoint,
    person?.updatedAt,
  ].join("|");
  const cached = images.get(key);
  if (cached && Date.now() - cached.at < 60000) return cached.value;
  if (images.size >= 100) images.delete(images.keys().next().value!);
  const value = apiFetch(endpoint)
    .then((r) => r.data.image || "")
    .catch((error) => {
      if (error?.status !== 404) images.delete(key);
      return "";
    });
  images.set(key, { at: Date.now(), value });
  return value;
}
