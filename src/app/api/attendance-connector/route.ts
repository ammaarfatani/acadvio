import {readFile} from "node:fs/promises";
import path from "node:path";
export const runtime="nodejs";
export async function GET(request:Request){const readme=new URL(request.url).searchParams.get("readme")==="1";const file=await readFile(path.join(process.cwd(),readme?"connectors/attendance/README.md":"connectors/attendance/connector.cjs"));return new Response(file,{headers:{"Content-Type":readme?"text/markdown; charset=utf-8":"application/javascript","Content-Disposition":readme?"attachment; filename=acadivo-connector-setup.md":"attachment; filename=acadivo-attendance-connector.cjs","X-Content-Type-Options":"nosniff"}});}
