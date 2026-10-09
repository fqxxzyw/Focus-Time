import {build} from 'esbuild';
import {writeFileSync} from 'node:fs';
// 复用真实演示生成器与数据校验，不维护第二套演示格式。
const result=await build({entryPoints:['src/demo.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {demo}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
writeFileSync('demo-data.json',JSON.stringify(demo(),null,2));
console.log('已生成 demo-data.json');
