import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
const letters=require('../studio/community-letters.js'),social=require('../studio/letter-social.js');
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=s=>String(s||'').replace(/<[^>]*>/g,'');
export function buildPublicLetters(out,root=ROOT){
  const index=letters.indexRead(JSON.parse(fs.readFileSync(path.join(root,'studio/letters/index.json'),'utf8'))),files=[];
  const build=fs.readFileSync(path.join(root,'studio/app.html'),'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
  function write(route,title,description,body){
    const canonical='https://processstudio.netlify.app/'+route.replace(/index\.html$/,'');
    const html='<!doctype html>\n<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
      +'<title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><link rel="canonical" href="'+canonical+'">'
      +'<meta property="og:type" content="article"><meta property="og:site_name" content="프로세스 레터"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(description)+'"><meta property="og:url" content="'+canonical+'"><meta property="og:image" content="https://processstudio.netlify.app/process-logo-1024.png"><meta name="twitter:card" content="summary">'
      +'<link rel="stylesheet" href="/vendor/fonts.css?v=2.552b"><link rel="stylesheet" href="/vendor/tokens.css?v=3.173"><link rel="stylesheet" href="/studio/community-letters.css?v='+build+'"><link rel="stylesheet" href="/studio/letter-social.css?v='+build+'">'
      +'<script defer src="/studio/letter-social.js?v='+build+'"></script><script defer src="/studio/letter-public.js?v='+build+'"></script></head>'
      +'<body class="pl-public"><header class="pl-public-header"><a class="pl-public-brand" href="/studio/letter/">PROCESS<br>LETTER</a><a href="/studio/app.html">프로세스 스튜디오 ↗</a></header>'
      +'<main id="letterContent">'+body+(body.includes('pl-count-note')?'':'<p class="pl-count-note">'+esc(social.countNote)+'</p>')+'<footer class="pl-public-footer">좋은 팀, 좋은 선수, 좋은 코치를 위한 글과 훈련.<br>PROCESS LETTER</footer></main></body></html>\n';
    fs.mkdirSync(path.dirname(path.join(out,route)),{recursive:true});fs.writeFileSync(path.join(out,route),html);files.push(route);
  }
  for(const entry of index){
    const d=JSON.parse(fs.readFileSync(path.join(root,'studio/letters',String(entry.number).padStart(2,'0')+'.json'),'utf8'));
    if(d.number!==entry.number||!d.title||!d.pieces)throw Error('Invalid public letter '+entry.number);
    write('studio/letter/'+String(d.number).padStart(2,'0')+'/index.html','프로세스 레터 '+String(d.number).padStart(2,'0')+'호 · '+plain(d.title),plain(d.sub),letters.article(d,{publicPage:true,social}));
  }
  const body='<div class="pl-shelf"><div class="pl-shelf-head"><div><span class="pl-kicker">PROCESS LETTER</span><h1>읽고, 생각하고, 훈련으로.</h1><p>동료 코치와 함께 읽고 싶은 이야기를 만나 보세요.</p></div></div><div class="pl-list">'
    +index.map(d=>'<a class="pl-row" href="/studio/letter/'+String(d.number).padStart(2,'0')+'/"><span class="pl-number"><small>LETTER</small>'+String(d.number).padStart(2,'0')+'</span><span class="pl-row-copy"><strong>'+esc(d.title)+'</strong><span>'+esc(plain(d.sub))+'</span><small>읽은 사람 <b data-letter-readers="'+d.number+'">—</b> · 좋았어요 <b data-letter-likes="'+d.number+'">—</b></small></span><span class="pl-arrow" aria-hidden="true">→</span></a>').join('')+'</div></div>';
  write('studio/letter/index.html','프로세스 레터','좋은 팀, 좋은 선수, 좋은 코치를 위한 글과 훈련.',body);
  return files;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const out=path.resolve(process.argv[2]||path.join(ROOT,'dist'));
  console.log('Public letters: '+buildPublicLetters(out).length+' pages → '+out);
}
