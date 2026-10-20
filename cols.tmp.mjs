import {tableFromIPC} from "apache-arrow";
import {readFile} from "node:fs/promises";
for (const f of ["celllines","drugs","conditions","drivers","ladder","verdicts","regulators","neighbourhood","ladder_factors"]) {
  const t = tableFromIPC(await readFile(`src/data/${f}.arrow`));
  console.log(f, t.numRows, "::", t.schema.fields.map(x=>x.name).join(", "));
  console.log("   e.g.", JSON.stringify(t.get(0)?.toJSON?.() ?? {}, (k,v)=>typeof v==="bigint"?Number(v):v).slice(0,300));
}
