from pathlib import Path
p=Path('src/components/SchoolReportCenter.tsx');s=p.read_text(encoding='utf-8');s=s.replace('{reportColumnLabel(report.key||report.report,c)}','{reportColumnLabel(report.key,c)}',1)
s=s.replace('''{String(
                              c.split(".").reduce((v, k) => v?.[k], row) ?? "—",
                            )}''','{displayReportCell(row,c)}')
p.write_text(s,encoding='utf-8')
p=Path('src/lib/report-presentation.ts');s=p.read_text(encoding='utf-8').replace('payroll:{employeeId:"Staff Name"}','payroll:{employeeId:"Employee ID"}');p.write_text(s,encoding='utf-8')
p=Path('src/server/services/smartReports.service.ts');s=p.read_text(encoding='utf-8').replace(',payroll:["employeeNumber"]','');s=s.replace('payroll:[rel("employeeId","employeeId","user","name",true),rel("employeeId","snapshot.employee.name","user"),...staff("employeeId")]', 'payroll:[rel("employeeId","employeeId","employment","employeeId",true),rel("employeeId","snapshot.employee.name","user")]');p.write_text(s,encoding='utf-8')
