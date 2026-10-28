"use client";
import { useEffect, useState, useRef } from "react";
import { profilePhoto } from "@/lib/profile-photo";
export function StudentAvatar({
  student,
  size = 36,
  kind = "student",
}: {
  student: any;
  size?: number;
  kind?: "student" | "staff";
}) {
  const [source, setSource] = useState("");
  const host = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "80px" },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    setSource("");
    if (!inView) return;
    profilePhoto(student, kind).then((image) => {
      if (active) setSource(image);
    });
    return () => {
      active = false;
    };
  }, [
    student?._id,
    student?.studentId,
    student?.photoUrl,
    student?.updatedAt,
    inView,
    kind,
  ]);
  const initials = String(student?.name || "Student")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((v) => v[0])
    .join("")
    .toUpperCase();
  return (
    <span
      ref={host}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 font-semibold text-zinc-600"
      style={{ width: size, height: size, fontSize: Math.max(12, size / 3) }}
    >
      {source ? (
        <img
          src={source}
          alt={`${student?.name || "Student"} profile photo`}
          className="h-full w-full object-cover"
          onError={() => setSource("")}
        />
      ) : (
        <span aria-label={`${student?.name || "Student"} initials`}>
          {initials}
        </span>
      )}
    </span>
  );
}

export function StaffAvatar({
  staff,
  size = 36,
}: {
  staff: any;
  size?: number;
}) {
  return <StudentAvatar student={staff} size={size} kind="staff" />;
}
