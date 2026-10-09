import type {ReactNode} from "react";
export function PageHeading({eyebrow,title,description,actions,detail}:{eyebrow?:ReactNode;title:ReactNode;description?:ReactNode;actions?:ReactNode;detail?:ReactNode}) {
 return <header className="ui-page-heading"><div className="ui-page-heading-copy">{eyebrow&&<p className="ui-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description&&<p className="ui-page-description">{description}</p>}{detail&&<div className="ui-page-detail">{detail}</div>}</div>{actions&&<div className="ui-page-actions">{actions}</div>}</header>;
}
export function LoadingOverview({label="Loading your workspace"}:{label?:string}) {return <div role="status" aria-label={label} className="ui-loading-overview"><span className="sr-only">{label}</span>{[0,1,2,3].map(n=><div key={n} className="ui-skeleton-tile"><span/><span/></div>)}</div>;}
