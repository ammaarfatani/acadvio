import PortalShell from "@/components/PortalShell";
import {ParentProvider,ParentSelection} from "@/lib/parent-context";
export default function Layout({children}:{children:React.ReactNode}){return <ParentProvider><PortalShell role="PARENT"><ParentSelection/>{children}</PortalShell></ParentProvider>;}
