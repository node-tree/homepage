// 폴더 이름변경 시 하위 NFD 파일명이 살아남는지 실계정으로 검증한다.
//   buildMapper 폴더 분기가 접미사를 NFC canonical 에서 잘라 붙이면 파일명이 NFC 로 바뀌고
//   그 URL 은 404 다. 이 스크립트가 그 회귀를 실물로 잡는다.
//   쓰기 범위: ImageKit /_ik-test-nfd (끝나면 삭제) + DB imagekit_ref_test·로그(actor:harness)
//   실행: node _workspace/09_media/harness/nfd-folder-live.js
const path=require('path');
const ROOT=path.resolve(__dirname,'../../..');
require(ROOT+'/backend/node_modules/dotenv').config({path:ROOT+'/backend/.env'});
const IK=require(ROOT+'/backend/node_modules/imagekit');
const {MongoClient}=require(ROOT+'/backend/node_modules/mongodb');
const axios=require(ROOT+'/backend/node_modules/axios');
const fs=require('fs'),https=require('https');
const ikRefsDb=require(ROOT+'/backend/lib/ikRefsDb');
const {folderRenameMapping}=require(ROOT+'/backend/lib/ikRefs');
const EP=process.env.IMAGEKIT_URL_ENDPOINT.replace(/\/+$/,'');
const ik=new IK({publicKey:process.env.IMAGEKIT_PUBLIC_KEY,privateKey:process.env.IMAGEKIT_PRIVATE_KEY,urlEndpoint:EP});
const F=fs.readFileSync(path.join(__dirname,'fixtures/exif6.jpg'));
const TESTCOL=ikRefsDb.TEST_COLLECTION;
const enc=p=>EP+p.split('/').map(encodeURIComponent).join('/');
const head=u=>new Promise(r=>https.get(u,s=>{s.resume();s.on('end',()=>r(s.statusCode))}).on('error',()=>r(0)));
let fails=0; const check=(l,c,d='')=>{ if(c)console.log('  PASS  '+l+(d?' — '+d:'')); else {fails++;console.log('  FAIL  '+l+(d?' — '+d:''));} };
(async()=>{
  const nfd='사진'.normalize('NFD'), nfc='사진'.normalize('NFC');
  const up=await ik.upload({file:F,fileName:nfd+'.jpg',folder:'/_ik-test-nfd/oldname',useUniqueFileName:false});
  console.log('업로드 filePath:', JSON.stringify(up.filePath));
  check('NFD 로 보관됨', up.filePath===`/_ik-test-nfd/oldname/${nfd}.jpg`);

  const mc=new MongoClient(process.env.MONGODB_URI);await mc.connect();const db=mc.db();
  await db.collection(TESTCOL).deleteMany({});
  await db.collection(TESTCOL).insertOne({_id:'nfd-doc', html:`<img src="${EP}${up.filePath}">`});

  // 폴더 이름변경(무료 플랜에서도 동작하는 bulkJobs/renameFolder)
  const auth='Basic '+Buffer.from(process.env.IMAGEKIT_PRIVATE_KEY+':').toString('base64');
  const {data}=await axios.post('https://api.imagekit.io/v1/bulkJobs/renameFolder',
    {folderPath:'/_ik-test-nfd/oldname', newFolderName:'newname'},
    {headers:{Authorization:auth,'Content-Type':'application/json'}});
  for(let i=0;i<40;i++){ const j=await ik.getBulkJobStatus(data.jobId).catch(()=>null);
    if(String(j&&j.status).toLowerCase()==='completed')break; await new Promise(r=>setTimeout(r,1500)); }

  // DB 참조 갱신 — 폴더 매핑
  const m=[folderRenameMapping('/_ik-test-nfd/oldname','newname')];
  const r=await ikRefsDb.applyMappings(db,m,{only:[TESTCOL],includeTest:true,actor:'harness'});
  const doc=await db.collection(TESTCOL).findOne({_id:'nfd-doc'});
  const written=doc.html.match(/src="([^"]+)"/)[1];
  console.log('DB 에 기록된 URL:', JSON.stringify(written));
  check('참조 1건 갱신', (r.refsUpdated[TESTCOL]||0)===1);
  check('기록된 URL 이 NFD 유지', written===`${EP}/_ik-test-nfd/newname/${nfd}.jpg`,
        written===`${EP}/_ik-test-nfd/newname/${nfc}.jpg`?'NFC 로 바뀜(버그)':'');
  const st=await head(enc(`/_ik-test-nfd/newname/${nfd}.jpg`));
  const stNfc=await head(enc(`/_ik-test-nfd/newname/${nfc}.jpg`));
  check('기록된(NFD) URL 이 실제로 200', st===200, 'status '+st);
  console.log(`  (대조) 같은 이름 NFC URL = ${stNfc} ← 404 여야 NFD 보존이 의미가 있다`);

  await ik.deleteFolder('/_ik-test-nfd').catch(e=>console.log('삭제 오류',e.message));
  await db.collection(TESTCOL).drop().catch(()=>{});
  const del=await db.collection(ikRefsDb.LOG_COLLECTION).deleteMany({actor:'harness'});
  console.log('정리: /_ik-test-nfd 삭제, 하네스 로그', del.deletedCount,'건 삭제');
  await mc.close();
  console.log('\n결과: 실패 '+fails+'건'); process.exit(fails?1:0);
})().catch(e=>{console.error('FATAL',e.message);process.exit(1)});
