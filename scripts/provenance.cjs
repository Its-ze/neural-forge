const fs=require('node:fs'),crypto=require('node:crypto'),cp=require('node:child_process'),path=require('node:path');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const source=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const dirty=Boolean(cp.execFileSync('git',['status','--porcelain','--untracked-files=normal'],{encoding:'utf8'}).trim());
const artifacts={};function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(entry.name!=='build-info.json')artifacts[p.replaceAll('\\','/').replace(/^dist\//,'')]={sha256:sha(p),size:fs.statSync(p).size};}}walk('dist');
fs.writeFileSync('dist/build-info.json',JSON.stringify({schemaVersion:1,version:require('../package.json').version,sourceCommit:source,sourceDirty:dirty,node:process.version,npm:cp.execFileSync(process.execPath,[process.env.npm_execpath,'--version'],{encoding:'utf8'}).trim(),packageLockSha256:sha('package-lock.json'),vite:require('vite/package.json').version,artifacts},null,2)+'\n');
