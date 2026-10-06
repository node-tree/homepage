// Read-only local fixture server. No database, proxying, or mutation endpoints.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve('build');
const raw = '/Users/kanghyunjung/Desktop/etx/web/nodetreeHome/_workspace/12_text_layout/raw';
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.pdf':'application/pdf','.wasm':'application/wasm'};
http.createServer((req,res)=>{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 const url = new URL(req.url, 'http://localhost');
 if(url.pathname.startsWith('/api/')) {
  const key = url.pathname.slice(5).replaceAll('/','_');
  const allowed = ['home','about','contact','work','cv','filed','work_header','filed_header'];
  res.setHeader('Content-Type','application/json');
  if(allowed.includes(key)) return res.end(fs.readFileSync(path.join(raw,key+'.json')));
  if(key==='home_all') return res.end(JSON.stringify({success:true,data:Object.fromEntries(['home','about','work','filed'].map(k=>[k,JSON.parse(fs.readFileSync(path.join(raw,k+'.json'))).data]))}));
  res.writeHead(404);return res.end('{"success":false}');
 }
 let file = path.resolve(root, '.'+decodeURIComponent(url.pathname));
 if(!file.startsWith(root+path.sep)){file=path.join(root,'index.html');}
 if(!fs.existsSync(file)||fs.statSync(file).isDirectory()) {
  if(path.extname(file)){res.writeHead(404);return res.end();}
  file=path.join(root,'index.html');
 }
 res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
 res.setHeader('Cache-Control','no-store');
 if(req.method==='HEAD')return res.end();
 fs.createReadStream(file).pipe(res);
}).listen(3601,'127.0.0.1',()=>console.log('Read-only snapshot preview: http://127.0.0.1:3601'));
