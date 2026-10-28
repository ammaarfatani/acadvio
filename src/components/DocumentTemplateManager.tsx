"use client";
import { useEffect, useState, useRef } from "react";
import { printSchoolDocument } from "@/lib/print-school-document";
import { apiFetch } from "@/lib/api";
import {
  DOCUMENT_TYPES,
  DOCUMENT_LABELS,
  DOCUMENT_FAMILIES,
  DocumentType,
  defaultDocumentStyle,
} from "@/lib/document-templates";
import { SchoolDocumentTemplate } from "./SchoolDocumentTemplate";
import SchoolLogoEditor from "./SchoolLogoEditor";
import { useAuth } from "@/lib/auth-context";
export default function DocumentTemplateManager() {
  const { user } = useAuth();
  const drafts = useRef<Record<string, any>>({}),
    canvas = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<any>(null);
  const [type, setType] = useState<DocumentType>("admission"),
    [settings, setSettings] = useState<any>(null),
    [style, setStyle] = useState(defaultDocumentStyle("admission")),
    [branding, setBranding] = useState<any>({}),
    [busy, setBusy] = useState(false),
    [imageBusy, setImageBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setSettings(null);
    setError("");
    Promise.all([
      apiFetch("/school-documents/settings"),
      apiFetch("/schools/profile"),
    ])
      .then(([configuration, school]) => {
        if (!active) return;
        setSettings(configuration.data);
        setBranding(configuration.data.branding);
        setType("admission");
        setStyle(configuration.data.templates.admission);
        setProfile(school.data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [user?.id, user?.branchId]);
  async function save(complete = false) {
    if (busy || imageBusy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await apiFetch("/school-documents/settings", {
        method: "PUT",
        body: JSON.stringify({
          revision: settings.revision,
          type,
          style: Object.fromEntries(
            Object.entries(style).filter(
              ([key, value]) =>
                JSON.stringify(value) !==
                JSON.stringify(settings.templates[type]?.[key]),
            ),
          ),
          branding: Object.fromEntries(
            Object.entries(branding).filter(
              ([key, value]) =>
                JSON.stringify(value) !==
                JSON.stringify(settings.branding?.[key]),
            ),
          ),
          complete,
        }),
      });
      setSettings(r.data);
      setStyle(r.data.templates[type]);
      setBranding(r.data.branding);
      drafts.current[type] = r.data.templates[type];
      setNotice("Saved to school records · revision " + r.data.revision);
      window.dispatchEvent(
        new CustomEvent("acadivo:document-settings-changed"),
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function category(value: DocumentType) {
    drafts.current[type] = style;
    setType(value);
    setStyle(drafts.current[value] || settings.templates[value]);
  }
  function move(section: string, direction: number) {
    const next = [...style.sectionOrder],
      i = next.indexOf(section),
      to = i + direction;
    if (to < 0 || to >= next.length) return;
    [next[i], next[to]] = [next[to], next[i]];
    setStyle({ ...style, sectionOrder: next });
  }
  async function image(key: string, file?: File) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 262144
    ) {
      setError("Choose a JPG, PNG or WebP signature/stamp under 256 KB.");
      return;
    }
    setImageBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      setBranding((b: any) => ({ ...b, [key]: String(reader.result) }));
      setImageBusy(false);
    };
    reader.onerror = () => {
      setError("Unable to read the image.");
      setImageBusy(false);
    };
    reader.readAsDataURL(file);
  }
  const sample = {
    type,
    style,
    school: {
      name: profile?.name || user?.school?.name || "School branding preview",
      address: profile?.address || user?.school?.address,
      logoUrl: profile?.logoUrl ?? user?.school?.logoUrl,
      phone: profile?.phone || user?.school?.phone,
      email: profile?.email,
      ...branding,
    },
    student: {
      name: "Sample Student — Preview",
      admissionNumber: "SAMPLE-001",
      className: "Class 5",
      sectionName: "A",
      academicSessionName: "Sample academic session",
      dob: "2015-04-15",
      gender: "Not provided",
      parentInfo: { fatherName: "Sample Guardian" },
      address: "Sample residential address",
      status: "Sample",
    },
    staff: { name: "Sample Staff — Preview", userType: "TEACHER" },
    statement:
      "Sample certificate statement. Replace with an authorized statement when generating a real document.",
    exam: { title: "Sample Mid-Term — Preview" },
    result: {
      _id: "SAMPLE",
      subjectScores: [
        {
          subjectName: "Mathematics",
          maxMarks: 100,
          obtainedMarks: 82,
          grade: "Sample A",
        },
        {
          subjectName: "Science",
          maxMarks: 100,
          obtainedMarks: 76,
          grade: "Sample B",
        },
      ],
      totalMaxMarks: 200,
      totalObtainedMarks: 158,
      percentage: 79,
      overallGrade: "Sample grade",
    },
    results: [
      {
        _id: "SAMPLE",
        examId: { title: "Sample examination" },
        subjectScores: [
          {
            subjectName: "Sample subject",
            maxMarks: 100,
            obtainedMarks: 80,
            grade: "Sample A",
          },
        ],
        totalMaxMarks: 100,
        totalObtainedMarks: 80,
        percentage: 80,
      },
    ],
    attendance: [
      {
        date: "2026-01-12",
        status: "SAMPLE PRESENT",
        remarks: "Sample attendance record",
      },
    ],
    payment: {
      receiptNumber: "SAMPLE-RECEIPT",
      studentName: "Sample Student — Preview",
      className: "Class 5",
      rollNumber: "SAMPLE",
      amountPKR: 2000,
      balanceAfterPKR: 500,
      paymentMethod: "Sample method",
      paidAt: "2026-01-12",
      documentSnapshot: {
        school: { name: user?.school?.name || "School branding preview" },
      },
      challanId: {
        challanNumber: "SAMPLE-CHALLAN",
        month: "Sample fee period",
        feeBreakdown: { tuitionFee: 2500 },
        totalAmountPKR: 2500,
        remainingAmountPKR: 500,
      },
    },
    ledger: {
      challans: [
        {
          _id: "SAMPLE",
          month: "Sample fee period",
          challanNumber: "SAMPLE",
          totalAmountPKR: 2500,
          paidAmountPKR: 2000,
          remainingAmountPKR: 500,
        },
      ],
      summary: { remainingBalance: 500 },
    },
    generatedAt: new Date().toISOString(),
  };
  if (!settings)
    return <p role="status">{error || "Loading document templates…"}</p>;
  return (
    <main className="document-studio min-w-0 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-red-700">
            School document studio
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            Choose your school document style
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Each category has its own saved style. Preview data is clearly
            marked and is never issued.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy || imageBusy}
            onClick={() =>
              void printSchoolDocument(
                canvas.current?.querySelector(".school-document"),
              ).catch((e) => setError(e.message))
            }
            className="rounded-md border bg-white px-4 py-3 text-sm font-semibold"
          >
            Print / Save preview PDF
          </button>
          <button
            disabled={busy || imageBusy}
            onClick={() => void save()}
            className="rounded-md bg-red-600 px-5 py-3 text-sm font-semibold text-white"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </header>
      {notice && (
        <p
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          {notice}
        </p>
      )}
      {type === "report-card" && <p className="text-xs text-zinc-500">This saved style is shared by marksheets, report cards and school-report PDFs. Previously issued records retain their archived design.</p>}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <fieldset
        disabled={busy || imageBusy}
        className="grid min-w-0 items-start gap-6 xl:grid-cols-[340px_1fr]"
      >
        <aside className="space-y-5 rounded-lg border bg-white p-5">
          <label className="grid gap-2 text-sm font-semibold">
            Document category
            <select
              value={type}
              onChange={(e) => category(e.target.value as DocumentType)}
              className="rounded border p-2"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3">
            {DOCUMENT_FAMILIES.map((f) => (
              <button
                type="button"
                key={f.id}
                aria-pressed={style.family === f.id}
                onClick={() => setStyle({ ...style, family: f.id })}
                className={`rounded-lg border p-3 text-left ${style.family === f.id ? "border-red-500 bg-red-50" : "border-zinc-200"}`}
              >
                <span className="dt-live-thumbnail" aria-hidden="true">
                  <SchoolDocumentTemplate
                    data={{ ...sample, style: { ...style, family: f.id } }}
                    preview
                  />
                </span>
                <strong className="block text-sm">
                  {f.name}
                  {style.family === f.id ? " · Selected" : ""}
                </strong>
                <span className="text-xs text-zinc-500">{f.description}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs">
              Accent color
              <input
                type="color"
                value={style.color}
                onChange={(e) => setStyle({ ...style, color: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-xs">
              Typeface
              <select
                value={style.font}
                onChange={(e) =>
                  setStyle({ ...style, font: e.target.value as any })
                }
              >
                <option value="sans">Clean sans serif</option>
                <option value="serif">Academic serif</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              Margin (mm)
              <input
                type="number"
                min={8}
                max={24}
                value={style.margin}
                onChange={(e) =>
                  setStyle({ ...style, margin: Number(e.target.value) })
                }
                className="border p-2"
              />
            </label>
            <label className="grid gap-1 text-xs">
              Spacing
              <select
                value={style.spacing}
                onChange={(e) =>
                  setStyle({ ...style, spacing: e.target.value as any })
                }
              >
                <option value="compact">Compact print</option>
                <option value="comfortable">Comfortable</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              Paper size
              <select
                value={style.pageSize || "A4"}
                onChange={(e) =>
                  setStyle({ ...style, pageSize: e.target.value as any })
                }
              >
                <option>A4</option>
                <option>A5</option>
                <option>Letter</option>
              </select>
            </label>
            {[
              ["photoWidth", "Photo width (mm)", 15, 60],
              ["photoHeight", "Photo height (mm)", 15, 70],
              ["signatureWidth", "Signature width (mm)", 15, 60],
              ["signatureHeight", "Signature height (mm)", 8, 30],
              ["stampSize", "Stamp size (mm)", 10, 35],
            ].map(([key, label, min, max]) => (
              <label key={String(key)} className="grid gap-1 text-xs">
                {label}
                <input
                  type="number"
                  min={Number(min)}
                  max={Number(max)}
                  value={(style as any)[key]}
                  onChange={(e) =>
                    setStyle({ ...style, [key]: Number(e.target.value) })
                  }
                  className="rounded border p-2"
                />
              </label>
            ))}
            <label className="grid gap-1 text-xs">
              Photo position
              <select
                value={style.photoAlign || "right"}
                onChange={(e) =>
                  setStyle({ ...style, photoAlign: e.target.value as any })
                }
              >
                <option value="right">Right</option>
                <option value="left">Left</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              Orientation
              <select
                value={style.orientation}
                onChange={(e) =>
                  setStyle({ ...style, orientation: e.target.value as any })
                }
              >
                <option>portrait</option>
                <option>landscape</option>
              </select>
            </label>
          </div>
          {(
            [
              ["showPhoto", "Student photograph"],
              ["showMedical", "Medical / support section"],
              ["showDeclaration", "Parent declaration"],
              ["showSignatures", "Signature areas"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={style[key]}
                onChange={(e) =>
                  setStyle({ ...style, [key]: e.target.checked })
                }
              />
              {label}
            </label>
          ))}
          <fieldset className="space-y-2">
            <legend className="mb-2 text-xs font-semibold">
              Section order (forms and profiles)
            </legend>
            {style.sectionOrder.map((section, i) => (
              <div
                key={section}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="capitalize">{section}</span>
                <span>
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(section, -1)}
                    aria-label={`Move ${section} up`}
                    className="border px-2 py-1"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={i === 3}
                    onClick={() => move(section, 1)}
                    aria-label={`Move ${section} down`}
                    className="border px-2 py-1"
                  >
                    ↓
                  </button>
                </span>
              </div>
            ))}
          </fieldset>
          <label className="grid gap-1 text-xs">
            Footer
            <textarea
              maxLength={300}
              value={style.footer}
              onChange={(e) => setStyle({ ...style, footer: e.target.value })}
              className="border p-2"
            />
          </label>
          {style.signatureLabels.map((value, i) => (
            <label key={i} className="grid gap-1 text-xs">
              Signature label {i + 1}
              <input
                maxLength={80}
                value={value}
                onChange={(e) =>
                  setStyle({
                    ...style,
                    signatureLabels: style.signatureLabels.map((v, j) =>
                      j === i ? e.target.value : v,
                    ),
                  })
                }
                className="border p-2"
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() => setStyle(defaultDocumentStyle(type))}
            className="text-xs font-semibold text-red-700"
          >
            Restore this category’s defaults
          </button>
          <p className="text-xs text-zinc-500">
            Preview changes are applied only after saving this category.
          </p>
          <button
            disabled={busy || imageBusy}
            onClick={() => void save()}
            className="w-full rounded bg-brand-600 p-3 text-sm font-semibold text-white"
          >
            {busy ? "Saving…" : "Save category style"}
          </button>
          {!settings.completedAt && (
            <div className="border-t pt-3">
              <button
                disabled={busy || imageBusy}
                onClick={() => void save(true)}
                className="text-xs font-semibold"
              >
                Finish setup / use selected defaults
              </button>
            </div>
          )}
        </aside>
        <div className="min-w-0 space-y-6">
          <div
            ref={canvas}
            className="overflow-auto rounded-lg border bg-zinc-200 p-5"
          >
            <div className="mx-auto w-fit">
              <SchoolDocumentTemplate data={sample} preview />
            </div>
          </div>
          <section className="space-y-4 rounded-lg border bg-white p-5">
            <h2 className="font-semibold">Shared school branding</h2>
            <SchoolLogoEditor
              logoUrl={profile?.logoUrl}
              onSaved={() =>
                void apiFetch("/schools/profile")
                  .then((r) => setProfile(r.data))
                  .catch((e) => setError(e.message))
              }
            />
            <p className="text-xs text-zinc-500">
              School name, address, phone and email are managed in School
              Settings. Only configure signatures and affiliations you are
              authorized to use.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["website", "School website"],
                ["principalName", "Principal name"],
                ["signatoryName", "Authorized signatory"],
                ["signatoryDesignation", "Designation"],
                ["affiliation", "Registration / affiliation (if recorded)"],
              ].map(([key, label]) => (
                <label key={key} className="grid gap-1 text-xs">
                  {label}
                  <input
                    value={branding[key] || ""}
                    onChange={(e) =>
                      setBranding({ ...branding, [key]: e.target.value })
                    }
                    className="border p-2"
                  />
                </label>
              ))}
              {["signature", "teacherSignature", "staffSignature", "stamp"].map(
                (key) => (
                  <label key={key} className="grid gap-2 text-xs capitalize">
                    {key} image (optional)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => void image(key, e.target.files?.[0])}
                    />
                    {branding[key] && (
                      <>
                        <img
                          src={branding[key]}
                          alt={`Configured ${key}`}
                          className="h-16 max-w-36 object-contain"
                        />
                        <button
                          onClick={() =>
                            setBranding({ ...branding, [key]: "" })
                          }
                          className="text-left text-red-700"
                        >
                          Remove {key}
                        </button>
                      </>
                    )}
                  </label>
                ),
              )}
            </div>
            <button
              disabled={busy || imageBusy}
              onClick={() => void save()}
              className="rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Save branding and selected style
            </button>
          </section>
        </div>
      </fieldset>
    </main>
  );
}

