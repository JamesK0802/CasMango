import type {GeneResult,TargetResult,MutationGroup} from '../../models/analysis.model';
import type {ComparisonRow} from './result-presentation';
export interface GuideReplicate {sample:string;target:TargetResult;reference?:string}
export interface GuideFile {sample:string;genes:GeneResult[]}
export interface GuideRegion {start:number;end:number;pamStart?:number;pamEnd?:number;reverse:boolean}
export interface GuideCell {text:string;type:string;position:number}
export interface GuideGroup {key:string;cells:GuideCell[];net:number;wt:boolean;complete:boolean;percentages:number[];mean:number;sd:number|null}
export interface GuideProfile {target:TargetResult;region:GuideRegion|null;groups:GuideGroup[];n:number;denominators:number[];error?:string}
const rc=(s:string)=>[...s].reverse().map(b=>({A:'T',T:'A',G:'C',C:'G',N:'N'}[b]||'N')).join('');
export function guideRegion(t:TargetResult):GuideRegion|null {
 const ref=t.ref_sequence?.toUpperCase()||'',guide=(t.display_sgrna_seq||t.sgrna_seq||'').replace(/\s/g,'').toUpperCase();if(!guide)return null;
 let start=t.grna_start_index,shown=guide,reverse=t.is_rc===true||t.strand==='reverse';
 if(start===undefined||start<0||ref.slice(start,start+guide.length)!==guide){const matches=[guide,rc(guide)].flatMap((g,i)=>{const at=ref.indexOf(g);return at>=0&&ref.indexOf(g,at+1)<0?[{at,g,reverse:i===1}]:[]});if(matches.length!==1)return null;start=matches[0].at;shown=matches[0].g;reverse=matches[0].reverse;}
 const end=start+shown.length,left=ref.slice(Math.max(0,start-3),start),right=ref.slice(end,end+3);let pamStart:number|undefined,pamEnd:number|undefined;
 // Annotate only an observed SpCas9-compatible flank, never invent a PAM.
 if(reverse&&/^CC[ACGT]$/.test(left)||!reverse&&!/^[ACGT]GG$/.test(right)&&/^CC[ACGT]$/.test(left)){pamStart=start-3;pamEnd=start;}
 else if(/^[ACGT]GG$/.test(right)){pamStart=end;pamEnd=end+3;}
 return{start,end,pamStart,pamEnd,reverse};
}
function project(t:TargetResult,g:MutationGroup,r:GuideRegion){
 const ref=t.ref_sequence!,letters:string[]=[],types:string[]=[],insert=new Map<number,string>();let p=0;
 for(const token of g.tokens||[]){if(token.type==='insert'){insert.set(p,(insert.get(p)||'')+token.val);continue;}for(const b of token.val){letters[p]=token.type==='delete'?'-':b;types[p]=token.type;p++;}}
 if(p!==ref.length)throw Error('Alignment tokens do not cover the reference window.');
 const edited=Array.from({length:r.end-r.start},(_,j)=>types[r.start+j]==='delete').some(Boolean)||[...insert].some(([at,v])=>at>r.start&&at<r.end&&v.length>0),complete=Array.from({length:r.end-r.start},(_,j)=>types[r.start+j]!=='unobserved').every(Boolean),cells:GuideCell[]=[];let net=0;
 for(let at=r.start;at<r.end;at++){const ins=at>r.start?insert.get(at)||'':'';for(const b of ins){cells.push({text:b,type:'insert',position:at});net++;}const type=types[at];cells.push({text:edited||!complete?letters[at]:ref[at],type:edited||!complete?type:'equal',position:at});if(type==='delete')net--;}
 // An internal substitution is retained only in a group with an internal indel.
 const key=!edited&&complete?'WT':JSON.stringify(cells.map(c=>[c.position,c.type,c.text]));return{key,cells,net,wt:!edited&&complete,complete};
}
export function guideGroupProfile(replicates:GuideReplicate[]):GuideProfile {
 const target=replicates[0]?.target,region=target?guideRegion(target):null,profile:GuideProfile={target,region,groups:[],n:replicates.length,denominators:[]};
 if(!region){profile.error='A complete, uniquely registered gRNA is required.';return profile;}
 const groups=new Map<string,GuideGroup>();
 for(const [i,rep]of replicates.entries()){
  const r=guideRegion(rep.target);if(!r||rep.target.ref_sequence!==target.ref_sequence||r.start!==region.start||r.end!==region.end){profile.error='Replicates must use the same reference window and gRNA.';return profile;}
  const selection=rep.target as TargetResult&{guideReportGroups?:string[];guideReportError?:string};if(selection.guideReportError){profile.error=selection.guideReportError;return profile;}const reportGroups=selection.guideReportGroups?new Set(selection.guideReportGroups):null;
  const selected=(rep.target.top_groups||[]).filter(g=>!reportGroups||reportGroups.has(g.read_inner)),denominator=selected.reduce((s,g)=>s+(Number.isFinite(g.read_count)&&g.read_count>0?g.read_count:0),0);profile.denominators.push(denominator);if(!denominator){profile.error='A replicate has no retained group counts; it cannot be treated as a zero-percent replicate.';return profile;}
  for(const g of selected){if(!Number.isFinite(g.read_count)||g.read_count<0){profile.error='Invalid retained read count.';return profile;}let projected:ReturnType<typeof project>;try{projected=project(rep.target,g,r);}catch(e){profile.error=String(e);return profile;}let group=groups.get(projected.key);if(!group){group={...projected,percentages:replicates.map(()=>0),mean:0,sd:null};groups.set(group.key,group);}group.percentages[i]+=100*g.read_count/denominator;}
 }
 for(const g of groups.values()){g.mean=g.percentages.reduce((a,b)=>a+b,0)/profile.n;g.sd=profile.n>1?Math.sqrt(g.percentages.reduce((s,v)=>s+(v-g.mean)**2,0)/(profile.n-1)):null;}
 profile.groups=[...groups.values()].sort((a,b)=>Number(a.wt)-Number(b.wt)||b.mean-a.mean||a.key.localeCompare(b.key));return profile;
}
export function replicateLabel(sample:string){return sample.split('/').pop()!.replace(/\.(?:fastq|fq)(?:\.gz)?$/i,'').replace(/(?:[-_ ]?(?:rep(?:licate)?|r)[-_ ]?)?\d+$/i,'').replace(/[-_ ]+$/,'')||sample;}
export function guideReplicateRows(files:GuideFile[],targetId:string,labels:Record<string,string>,names:readonly string[]):ComparisonRow[]{
 const rows=new Map<string,ComparisonRow>();for(const f of files)for(const name of names){const gene=f.genes.find(g=>g.gene===name),target=gene?.analysis_result.targets.find(t=>t.target_id===targetId)||{target_id:targetId}as TargetResult;const label=labels[f.sample]?.trim()||replicateLabel(f.sample),key=JSON.stringify([label,name]);let row=rows.get(key);if(!row){row={name:label+(names.length>1?' · '+name:''),target,guideReplicates:[],reads:0,wt:null,substitution:null,inFrame:null,outOfFrame:null,edited:null};rows.set(key,row);}row.guideReplicates!.push({sample:f.sample,target,reference:name});}return [...rows.values()];
}
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export function guideAnnotationSpan(rows:ComparisonRow[]){return Math.max(1,...rows.map(row=>{const r=row.target?guideRegion(row.target):null;return r?Math.max(r.end,r.pamEnd??r.end)-Math.min(r.start,r.pamStart??r.start):60;}));}
export function renderGuideAnnotation(rows:ComparisonRow[],inner:number,font:number,span:number,limit:number){
 let out='',top=72;const text=(x:number,y:number,v:unknown,size=font,extra='')=>`<text x="${x}" y="${y}" font-size="${size}" ${extra}>${esc(v)}</text>`;
 for(const row of rows){const profile=guideGroupProfile(row.guideReplicates||[{sample:row.name,target:row.target!}]);out+=`<title>${esc(row.name)}</title>`;if(rows.length>1){out+=text(0,top,row.name.length>inner/(font*.65)?row.name.slice(0,Math.max(1,Math.floor(inner/(font*.65))-1))+'…':row.name,font,'font-weight="700"');top+=26;}if(profile.error||!profile.region){out+=text(0,top,profile.error||'gRNA unavailable',11,'fill="#64748b"');top+=36;continue;}
  const{region:r,target}=profile,ref=target.ref_sequence!,length=Math.min(ref.length,Math.max(1,Math.round(span))),start=Math.max(0,Math.min(ref.length-length,Math.floor((Math.min(r.start,r.pamStart??r.start)+Math.max(r.end,r.pamEnd??r.end)-length)/2))),end=start+length;
  const reference:GuideCell[]=[...ref.slice(start,end)].map((b,j)=>({text:b,type:'equal',position:start+j})),selected=profile.groups.slice(0,Math.max(0,limit-Number(profile.groups.some(g=>g.wt)))),wt=profile.groups.find(g=>g.wt);if(wt&&!selected.includes(wt))selected.push(wt);
  const groupCells=(g:GuideGroup)=>{const cells:GuideCell[]=[];for(let p=start;p<end;p++){if(p>=r.start&&p<r.end)cells.push(...g.cells.filter(c=>c.position===p));else cells.push({text:ref[p],type:'equal',position:p});}return cells;},groups=selected.map(g=>({g,cells:groupCells(g)})),seqX=24,contributionX=inner-100,usable=contributionX-seqX-38,size=Math.min(12,font),step=size*.65,maxColumns=Math.max(1,Math.floor(usable/step));
  const sequence=(cells:GuideCell[],y:number,complement=false,first=true,last=true)=>{cells.forEach((c,j)=>{const x=seqX+(j+.5)*step,pam=r.pamStart!==undefined&&c.position>=r.pamStart&&c.position<r.pamEnd!,guide=c.position>=r.start&&c.position<r.end;const color=complement&&guide?'#2563eb':c.type==='substitute'?'#2563eb':c.type==='insert'||c.type==='delete'?'#dc2626':c.type==='unobserved'?'#94a3b8':'#1e293b';out+=text(x,y,complement?rc(c.text):c.text,size,`data-guide-base="${c.type}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" text-anchor="middle" fill="${color}"${pam?' font-weight="700"':''}`);if(c.type==='substitute')out+=`<path d="M${x-step*.35} ${y+3}h${step*.7}" stroke="#2563eb"/>`;});if(first)out+=text(0,y,complement?'3′':'5′',11);if(last)out+=text(seqX+(cells.length+.7)*step,y,complement?'5′':'3′',11);};
  for(let at=0;at<reference.length;at+=maxColumns){const chunk=reference.slice(at,at+maxColumns),last=at+maxColumns>=reference.length;sequence(chunk,top,false,at===0,last);sequence(chunk,top+22,true,at===0,last);
   const mark=(lo:number,hi:number,label:string)=>{lo=Math.max(start+at,lo);hi=Math.min(start+at+chunk.length,hi);if(hi<=lo)return;const x=seqX+(lo-start-at)*step,w=(hi-lo)*step;out+=`<path d="M${x} ${top+28}h${w}" stroke="#1e293b"/>`+text(x+w/2,top+43,label,10,'text-anchor="middle"');};mark(r.start,r.end,'gRNA');if(r.pamStart!==undefined)mark(r.pamStart,r.pamEnd!,'PAM');top+=76;
  }
  out+=text(contributionX,top-12,'Contribution',11);for(const{g,cells}of groups){out+=text(contributionX,top,`${g.mean.toFixed(1)}${g.sd===null?'':' ± '+g.sd.toFixed(1)}%`,11,`data-guide-group="${esc(g.key)}"`);for(let at=0;at<cells.length;at+=maxColumns)sequence(cells.slice(at,at+maxColumns),top+22*Math.floor(at/maxColumns),false,at===0,at+maxColumns>=cells.length);top+=Math.max(30,22*Math.ceil(cells.length/maxColumns)+8);}
  if(profile.groups.length>selected.length){out+=text(0,top,`${profile.groups.length-selected.length} additional retained gRNA groups not shown`,10,'fill="#64748b"');top+=20;}
  out+=text(0,top+4,`n = ${profile.n} ${profile.n===1?'sample · SD unavailable':'replicates · mean ± sample SD'}`,10,'fill="#64748b"');top+=28;
 }
 const note=(value:string)=>{const words=value.split(' '),limit=Math.max(15,Math.floor(inner/5.5));let line='';for(const word of words){if(line.length+word.length+1>limit){out+=text(0,top+3,line,10,'fill="#64748b"');top+=16;line='';}line+=(line?' ':'')+word;}if(line){out+=text(0,top+3,line,10,'fill="#64748b"');top+=16;}};
 note('WT = no indel inside gRNA; outside-only changes and substitution-only groups are combined.');note('Each replicate: retained groups = 100%; absent groups = 0. Outside sequence shows reference context.');return{svg:out,height:top+16};
}
