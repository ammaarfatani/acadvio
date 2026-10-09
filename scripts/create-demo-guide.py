from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
root=Path("output/pdf");root.mkdir(parents=True,exist_ok=True)
p=root/"acadivo-demo-parent-guide.pdf"
c=canvas.Canvas(str(p),pagesize=A4);w,h=A4;c.setTitle("Acadivo - demo parent guide")
c.setFillColor(HexColor("#dc2626"));c.rect(42,h-53,w-84,4,fill=1,stroke=0)
c.setFillColor(HexColor("#111111"));c.setFont("Helvetica-Bold",23);c.drawString(42,h-95,"Acadivo")
c.setFont("Helvetica",10);c.setFillColor(HexColor("#71717a"));c.drawString(42,h-118,"Aptech International Institute | DEMO WORKSPACE")
c.setFillColor(HexColor("#111111"));c.setFont("Helvetica-Bold",19);c.drawString(42,h-162,"Parent portal guide")
style=ParagraphStyle("body",fontName="Helvetica",fontSize=11,leading=17,textColor=HexColor("#3f3f46"))
y=h-195
sections=[("Your family", "Sign in with the demo parent account provided by the school administrator. The selected child controls the records shown across the parent portal."),("Academics and attendance", "Review your child's assigned class, eight class subjects, weekly lessons and daily attendance. Select Mid-Term or Final Term to view the applicable examination date sheet."),("Results", "Published results contain the subjects configured for the child's class. The combined marksheet shows Mid-Term and Final Term marks and weighted totals. Pending or unpublished marks remain clearly labelled."),("Fees and receipts", "The demo records include paid, partially paid, unpaid and overdue invoices. Fee receipts and payment history are linked to the selected child's records."),("Documents and updates", "Download school documents and read announcements relevant to your child's class. Notifications and read states belong to your parent account.")]
for title,body in sections:
 c.setFillColor(HexColor("#111111"));c.setFont("Helvetica-Bold",12);c.drawString(42,y,title);y-=13
 para=Paragraph(body,style);pw,ph=para.wrap(w-84,200);para.drawOn(c,42,y-ph);y-=ph+28
c.setStrokeColor(HexColor("#e4e4e7"));c.line(42,77,w-42,77);c.setFillColor(HexColor("#71717a"));c.setFont("Helvetica",9)
c.drawString(42,58,"Synthetic demo data | 7 October 2026");c.drawRightString(w-42,58,"1 / 1")
c.save()
from pypdf import PdfReader
pdf=PdfReader(p);assert len(pdf.pages)==1
assert "Parent portal guide" in pdf.pages[0].extract_text();print("Created and text-validated one-page demo guide; render with bundled Poppler.")
