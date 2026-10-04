import 'server-only';
const project=process.env.VERCEL_PROJECT_ID||'prj_UvGrR8u4QEKFXGJnIwNOYpFdXojQ';
export async function vercelDomainRequest(path:string,token:string,method='GET',body?:unknown){
 const url=new URL(path,'https://api.vercel.com');
 if(process.env.VERCEL_TEAM_ID)url.searchParams.set('teamId',process.env.VERCEL_TEAM_ID);
 const res=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(15000)});
 const data=await res.json();
 if(!res.ok)throw new Error(`Vercel: ${data.error?.code??res.status}`);
 return data;
}
export const domainProjectPath=(host?:string)=>`/v9/projects/${encodeURIComponent(project)}/domains${host?'/'+encodeURIComponent(host):''}`;
export async function registerDomain(host:string,token:string){
 // An existing domain must be checked on this project, never transferred.
 try{await vercelDomainRequest(domainProjectPath(host),token);}catch(error){
  if(!(error instanceof Error)||!error.message.includes('404')&&!error.message.includes('not_found'))throw error;
  await vercelDomainRequest(`/v10/projects/${encodeURIComponent(project)}/domains`,token,'POST',{name:host});
 }
}
export async function inspectDomain(host:string,token:string){
 let domain=await vercelDomainRequest(domainProjectPath(host),token);
 if(!domain.verified){try{domain=await vercelDomainRequest(domainProjectPath(host)+'/verify',token,'POST');}catch{/* Keep pending challenges for the admin. */}}
 const config=await vercelDomainRequest(`/v6/domains/${encodeURIComponent(host)}/config`,token);
 return {active:domain.verified===true&&config.misconfigured===false&&!domain.redirect&&!domain.gitBranch&&!domain.customEnvironmentId,details:{verification:domain.verification??[],recommendedCNAME:config.recommendedCNAME??[],recommendedIPv4:config.recommendedIPv4??[],misconfigured:config.misconfigured}};
}
