import type ExcelJS from 'exceljs';
/** Worksheet membership is presentation evidence for the NEW guide figure only.
 * Restoration baselines and all existing analysis percentages remain untouched. */
export function captureGuideReportSelections(wb:ExcelJS.Workbook,scopes:any[]){
 for(const scope of scopes){if(scope.sheetName==='Merged')continue;const sheet=wb.getWorksheet(scope.sheetName.replace(/[\\/*?[\]:]/g,'_').substring(0,31));if(!sheet)continue;const selections:Record<string,{sequences:string[];error?:string}>={};let gene='',target='',aligned:number|undefined,active:string|undefined;
  sheet.eachRow(row=>{const cell=row.getCell(7),label=cell.text;
   if(label.startsWith('Gene: ')){gene=label.slice(6);active=undefined;return;}
   if(label.startsWith('Target: ')){target=label.slice(8);active=JSON.stringify([gene,target]);selections[active]={sequences:[]};aligned=undefined;return;}
   if(!active)return;
   if(label==='Aligned Reads'){aligned=Number(row.getCell(8).value);(selections[active]as any).aligned=aligned;return;}
   if(typeof cell.value==='number'&&typeof row.getCell(8).value==='number'){
    let sequence='';row.eachCell({includeEmpty:false},(c,col)=>{if(col>=10)sequence+=c.text;});selections[active].sequences.push(sequence.replace(/-/g,''));
   }
  });
  for(const[key,selection]of Object.entries(selections)){const[g,t]=JSON.parse(key),result=scope.genes?.find((a:any)=>a.gene===g)?.analysis_result?.targets.find((a:any)=>a.target_id===t),lookup=new Map<string,number>((result?.top_groups||[]).map((a:any)=>[a.read_inner,a.read_count]));let sum=0;const unique=new Set(selection.sequences);for(const sequence of unique){if(!lookup.has(sequence)){selection.error='A displayed worksheet group cannot be matched to its stored read count.';break;}sum+=lookup.get(sequence)!;}
   if(!selection.error&&(!Number.isFinite((selection as any).aligned)||sum!==(selection as any).aligned||unique.size!==selection.sequences.length))selection.error='Displayed worksheet groups do not match the recorded aligned-read count.';delete(selection as any).aligned;
  }
  if(Object.keys(selections).length)scope.guideFigureSelections=selections;
 }
}
