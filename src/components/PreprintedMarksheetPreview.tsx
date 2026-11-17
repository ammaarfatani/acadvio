"use client";

import { alignmentFields, defaultAlignmentFields, getPageSize, type AlignmentField, type MarksheetPrintSettings } from "@/lib/marksheet-print-settings";

type ExamOption = { _id: string; title: string; term?: string; academicSessionId?: string; academicSessionName?: string };
const valueNames: Record<string, string> = {
  studentName: "Ayesha Khan", fatherName: "Muhammad Khan", className: "Class 5", sectionName: "A", grNumber: "SAMPLE-0526",
  examinationName: "Selected Examination", academicSession: "Academic Session", totalMarks: "426 / 500", percentage: "85.20%",
  grade: "A", rank: "3", attendance: "96%", teacherComments: "A strong result. Keep up the good work.",
  serialNumber: "1", subjectName: "English", exam0Max: "100", exam0Obtained: "82", exam1Max: "100", exam1Obtained: "86",
  exam2Max: "200", exam2Obtained: "168", exam3Max: "100", exam3Obtained: "90", grandMax: "500", grandObtained: "426", status: "PASS",
  examTitle0: "First Term", examTitle1: "Half Yearly", examTitle2: "Grand Total", examTitle3: "Final", classTeacherSignature: "", principalSignature: "", stamp: "",
};
const sampleRows = [
  { serial: "1", name: "English", scores: [[100, 82], [100, 86], [200, 168], [100, 90]], grand: [500, 426], status: "PASS" },
  { serial: "2", name: "Mathematics", scores: [[100, 91], [100, 88], [200, 179], [100, 94]], grand: [500, 450], status: "PASS" },
  { serial: "3", name: "General Science", scores: [[100, 79], [100, 84], [200, 163], [100, 89]], grand: [500, 415], status: "PASS" },
  { serial: "4", name: "Social Studies", scores: [[100, 88], [100, 89], [200, 177], [100, 92]], grand: [500, 446], status: "PASS" },
];

export default function PreprintedMarksheetPreview({ settings, exams }: { settings: MarksheetPrintSettings; exams: ExamOption[] }) {
  const [width, height] = getPageSize(settings);
  const selected = exams.find(exam => exam._id === settings.exam);
  const sessionId = selected?.academicSessionId || exams[0]?.academicSessionId;
  const sessionExams = exams.filter(exam => !sessionId || exam.academicSessionId === sessionId);
  const chosen = settings.exam === "annual" ? sessionExams.filter(exam => exam.term === "MID_TERM" || exam.term === "FINAL_TERM").slice(0, 4) : selected ? [selected] : sessionExams.slice(0, 4);
  const titles = chosen.length ? chosen.map(exam => exam.title) : ["No scheduled examinations"];
  const sessionName = selected?.academicSessionName || (chosen[0]?.academicSessionName) || "Select an examination to see its session";
  const examHeading = settings.exam === "annual" ? chosen.map(exam => exam.title).join(" / ") || "Annual Result" : selected?.title || chosen.map(exam => exam.title).join(" / ") || valueNames.examinationName;
  const fields = settings.fields || defaultAlignmentFields;
  const positioned = (field: AlignmentField) => {
    const position = fields[field] || defaultAlignmentFields[field];
    const rowField = ["serialNumber", "subjectName", "exam0Max", "exam0Obtained", "exam1Max", "exam1Obtained", "exam2Max", "exam2Obtained", "exam3Max", "exam3Obtained", "grandMax", "grandObtained", "status"].includes(field);
    return { ...position, y: (rowField ? settings.rowStartY + position.y : position.y) + settings.offsetY, x: position.x + settings.offsetX };
  };
  const drawValue = (field: AlignmentField, value: string, row = 0) => {
    const position = positioned(field);
    const y = position.y + (row && ["serialNumber", "subjectName", "exam0Max", "exam0Obtained", "exam1Max", "exam1Obtained", "exam2Max", "exam2Obtained", "exam3Max", "exam3Obtained", "grandMax", "grandObtained", "status"].includes(field) ? row * settings.rowHeight : 0);
    return <span key={`${field}-${row}`} className="absolute overflow-hidden whitespace-nowrap" style={{ left: `${position.x / width * 100}%`, top: `${y / height * 100}%`, width: `${position.width / width * 100}%`, height: `${position.height / height * 100}%`, fontSize: `${Math.max(6, position.fontSize * 0.7)}px`, fontWeight: position.bold ? 700 : 400, textAlign: position.align, lineHeight: position.lineHeight }}>{value}</span>;
  };
  const dynamicContent = <>
    {settings.studentDetails && <>
      {drawValue("studentName", valueNames.studentName)}{drawValue("fatherName", valueNames.fatherName)}{drawValue("className", valueNames.className)}
      {drawValue("sectionName", valueNames.sectionName)}{drawValue("grNumber", valueNames.grNumber)}{drawValue("examinationName", examHeading)}{drawValue("academicSession", sessionName)}
    </>}
    {settings.marksTable && <>
      {titles.slice(0, 4).map((title, index) => drawValue((`examTitle${index}`) as AlignmentField, title))}
      {sampleRows.map((row, index) => <span key={`row-${index}`}>{[
        drawValue("serialNumber", row.serial, index), drawValue("subjectName", row.name, index),
        ...row.scores.flatMap((score, component) => [drawValue((`exam${component}Max`) as AlignmentField, String(score[0]), index), drawValue((`exam${component}Obtained`) as AlignmentField, String(score[1]), index)]),
        drawValue("grandMax", String(row.grand[0]), index), drawValue("grandObtained", String(row.grand[1]), index), drawValue("status", row.status, index),
      ]}</span>)}
    </>}
    {settings.resultSummary && <>{drawValue("totalMarks", valueNames.totalMarks)}{drawValue("percentage", valueNames.percentage)}{drawValue("grade", valueNames.grade)}{drawValue("rank", valueNames.rank)}{drawValue("attendance", valueNames.attendance)}</>}
    {settings.teacherComments && drawValue("teacherComments", valueNames.teacherComments)}
  </>;

  return <section className="min-w-0 rounded-xl border bg-zinc-100 p-4" aria-label="Live marksheet preview">
    <div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="font-semibold text-zinc-900">Live preview</h3><p className="text-xs text-zinc-600">Fictional preview data · {settings.mode === "values" ? "dynamic values only" : "complete table"}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs text-zinc-600">{settings.orientation}</span></div>
    {settings.mode === "table" ? <div className="mx-auto max-h-[78vh] max-w-[620px] overflow-auto rounded bg-white shadow" style={{ aspectRatio: `${width}/${height}` }}>
      <div className="min-h-full p-[5%] text-[clamp(7px,1vw,12px)] text-zinc-900">
        <h2 className="border-b pb-2 text-center text-[1.5em] font-bold">{examHeading}</h2><p className="mb-3 mt-1 text-center">Academic Session {sessionName}</p>
        {settings.studentDetails && <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 border p-2"><p><b>Name:</b> Ayesha Khan</p><p><b>Father&apos;s Name:</b> Muhammad Khan</p><p><b>Class:</b> Class 5</p><p><b>Section:</b> A</p><p><b>G.R. No:</b> SAMPLE-0526</p></div>}
        {settings.marksTable && <table className="w-full border-collapse text-center"><thead><tr><th rowSpan={2} className="border p-1 text-left">Subject</th>{titles.slice(0, 4).map(title => <th key={title} colSpan={2} className="border p-1">{title}</th>)}<th colSpan={2} className="border p-1">Grand Total</th><th rowSpan={2} className="border p-1">Status</th></tr><tr>{titles.slice(0, 4).flatMap(title => [<th key={`${title}-max`} className="border p-1">Max</th>, <th key={`${title}-obt`} className="border p-1">Obt.</th>])}<th className="border p-1">Max</th><th className="border p-1">Obt.</th></tr></thead><tbody>{sampleRows.map(row => <tr key={row.serial}><td className="border p-1 text-left">{row.name}</td>{titles.slice(0, 4).flatMap((title, index) => [<td key={`${row.serial}-${title}-max`} className="border p-1">{row.scores[index]?.[0] ?? "—"}</td>, <td key={`${row.serial}-${title}-obt`} className="border p-1">{row.scores[index]?.[1] ?? "—"}</td>])}<td className="border p-1">{row.grand[0]}</td><td className="border p-1">{row.grand[1]}</td><td className="border p-1">{row.status}</td></tr>)}</tbody></table>}
        {settings.resultSummary && <div className="my-3 grid grid-cols-3 gap-2 border p-2"><p><b>Total Marks:</b> 500</p><p><b>Obtained:</b> 426</p><p><b>Percentage:</b> 85.20%</p><p><b>Grade:</b> A</p><p><b>Rank:</b> 3</p><p><b>Attendance:</b> 96%</p></div>}
        {settings.teacherComments && <p className="my-3 border p-2"><b>Teacher Comments:</b> A strong result. Keep up the good work.</p>}
        {settings.signatures && <div className="mt-8 flex justify-between"><p className="border-t px-3 pt-1">Sign of Class Teacher</p><p className="border-t px-3 pt-1">Sign of Principal</p></div>}
      </div>
    </div> : <div className="max-h-[78vh] overflow-auto rounded bg-zinc-200 p-3">
      <div className="relative mx-auto overflow-hidden bg-white shadow" style={{ width: "min(100%, 560px)", aspectRatio: `${width}/${height}`, backgroundImage: settings.backgroundImage ? `url(${settings.backgroundImage})` : undefined, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }}>
        {!settings.backgroundImage && <div aria-hidden="true" className="pointer-events-none absolute inset-0 select-none text-[clamp(6px,0.8vw,10px)] text-zinc-500">
          <div className="absolute left-[7%] right-[7%] top-[4%] flex h-[9%] items-center justify-center border-y border-zinc-400 bg-zinc-50 text-center font-semibold tracking-wide">School heading and logo · already printed</div>
          <span className="absolute left-[6%] top-[15%]">Name:</span><span className="absolute left-[52%] top-[15%]">Father&apos;s Name:</span>
          <span className="absolute left-[6%] top-[18.5%]">Class:</span><span className="absolute left-[37%] top-[18.5%]">Section:</span><span className="absolute left-[62%] top-[18.5%]">G.R. No:</span>
          <span className="absolute left-[6%] top-[22%]">Examination:</span><span className="absolute left-[55%] top-[22%]">Academic Session:</span>
          <div className="absolute left-[6%] right-[6%] top-[29%] h-[36%] border border-zinc-400">
            <div className="grid h-[13%] grid-cols-[6%_28%_13%_13%_13%_13%_14%] border-b border-zinc-400 bg-zinc-50 text-center font-semibold"><span className="border-r">#</span><span className="border-r">Subject</span><span className="border-r">{titles[0] || "Exam 1"}</span><span className="border-r">Obt.</span><span className="border-r">{titles[1] || "Exam 2"}</span><span className="border-r">Obt.</span><span>Grand Total</span></div>
            {Array.from({ length: 10 }, (_, index) => <div key={index} className="grid h-[8.7%] grid-cols-[6%_28%_13%_13%_13%_13%_14%] border-b border-zinc-300 last:border-0"><span className="border-r"/><span className="border-r"/><span className="border-r"/><span className="border-r"/><span className="border-r"/><span className="border-r"/><span/></div>)}
          </div>
          <div className="absolute left-[6%] right-[6%] top-[68%] grid h-[7%] grid-cols-3 border border-zinc-400"><span className="border-r p-1">Total / Obtained Marks</span><span className="border-r p-1">Percentage / Grade</span><span className="p-1">Rank / Attendance</span></div>
          <div className="absolute left-[6%] right-[6%] top-[78%] h-[6%] border border-zinc-400 p-1">Teacher Comments</div>
          <div className="absolute left-[6%] top-[88%] w-[38%] border-t border-zinc-500 pt-1 text-center">Sign of Class Teacher</div><div className="absolute right-[6%] top-[88%] w-[38%] border-t border-zinc-500 pt-1 text-center">Sign of Principal</div>
        </div>}
        {dynamicContent}
      </div>
    </div>}
  </section>;
}
