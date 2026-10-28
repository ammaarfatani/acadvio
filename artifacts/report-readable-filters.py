from pathlib import Path
p=Path('src/server/services/smartReports.service.ts');s=p.read_text(encoding='utf-8');s=s.replace('''  filters: Filters,
) {
  const lookups:''','''  filters: Filters, reportKey?:string,
) {
  const descriptions:Record<string,string>={};
  const lookups:''',1)
s=s.replace('''    if (
      field === "employeeId" &&''','''    descriptions[field]=[ref.name||ref.title,field==="studentId"?ref.studentId||ref.admissionNumber:field==="employeeId"?ref.employeeId:undefined].filter(Boolean).join(" · ")||"Selected school record";
    if (
      field === "employeeId" &&''',1)
s=s.replace('''      field === "studentId" &&
      ((filters.classId''','''      field === "studentId" && (!reportKey||["students","guardians"].includes(reportKey)) &&
      ((filters.classId''',1)
s=s.replace('''  }
}
export function authorizeReports''','''  }
  return descriptions;
}
export function authorizeReports''',1)
s=s.replace('  await validateReportReferences(actor, filters);','  const filterLabels=await validateReportReferences(actor, filters,selection.report);')
s=s.replace('    note: spec.note,\n  };','    note: spec.note,filterLabels,\n  };',1)
p.write_text(s,encoding='utf-8')
p=Path('src/components/SchoolReportCenter.tsx');s=p.read_text(encoding='utf-8');s=s.replace('reportFilterLabel,displayReportCell','reportFilterLabel,displayReportCell,readableReportValue');s=s.replace('    [preview, setPreview] = useState<any[]>([]),','    [filterLabels,setFilterLabels]=useState<Record<string,string>>({}),\n    [preview, setPreview] = useState<any[]>([]),');s=s.replace('{label(k)}: {filters[k]} ×','{reportFilterLabel(k)}: {filterLabels[k+":"+filters[k]]||preview[0]?.filterLabels?.[k]||(k.endsWith("Id")?"Selected school record":readableReportValue(filters[k],k))} ×')
s=s.replace('''            <FilterPicker
''','''            <FilterPicker
              onLabel={(field:string,value:string,name:string)=>setFilterLabels(previous=>({...previous,[field+":"+value]:name}))}
''',1)
s=s.replace('''  onChange,
}: {
  catalogue:''','''  onChange,onLabel,
}: {
  onLabel:(field:string,value:string,name:string)=>void;
  catalogue:''',1)
s=s.replace('''            onChange({ ...filters, [field]: value.trim() });''','''            onLabel(field,value.trim(),options.find(o=>o.value===value)?.label||String(readableReportValue(value,field)));
            onChange({ ...filters, [field]: value.trim() });''')
s=s.replace('''                      {v}
                    </option>''','''                      {readableReportValue(v,field)}
                    </option>''')
p.write_text(s,encoding='utf-8')
p=Path('src/server/services/reportExport.service.ts');s=p.read_text(encoding='utf-8');s=s.replace('    const sheet = XLSX.utils.aoa_to_sheet(values);','''    const sheet = XLSX.utils.aoa_to_sheet(values);
    report.columns.forEach((column,index)=>{if(/PKR$|percentage/i.test(column))for(let row=1;row<values.length;row++){const cell=sheet[XLSX.utils.encode_cell({r:row,c:index})];if(cell?.t==="n")cell.z=/PKR$/.test(column)?"#,##0.00":"0.00";}});''');p.write_text(s,encoding='utf-8')
