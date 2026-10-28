"use client";
import { useEffect, useState } from "react";
import { profilePhoto } from "@/lib/profile-photo";
export function DocumentProfilePhoto({ student }: { student: any }) {
  const [image, setImage] = useState(""),
    [loading, setLoading] = useState(!!student?._id);
  useEffect(() => {
    let live = true;
    setImage("");
    if (!student?._id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    profilePhoto(student)
      .then((r) => {
        if (live) setImage(r);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [student?._id, student?.updatedAt]);
  return (
    <div className="sd-portrait-row" data-document-ready={!loading}>
      <strong>{student?.name}</strong>
      {image ? (
        <img
          src={image}
          onError={() => setImage("")}
          alt={`${student.name} profile photograph`}
        />
      ) : (
        <span className="text-xs text-zinc-500">
          {loading ? "Loading profile photograph…" : "Photograph not provided"}
        </span>
      )}
    </div>
  );
}
