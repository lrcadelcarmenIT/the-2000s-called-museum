/* ============ PASS 3: quiz, photo booth, soundboard, timeline, i18n, presence, memory wall ============ */
(()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc2=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------------- Taglish toggle ---------------- */
let LANG='en';
try{LANG=localStorage.getItem('museum-lang')||'en'}catch(e){}
const T={
 'nav-explore':['Explore','Tuklasin'],
 'nav-archive':['All exhibits','Lahat ng exhibit'],
 'nav-arcade':['Arcade','Arcade'],
 'nav-quiz':['Quiz','Quiz'],
 'nav-play':['Playground','Palaruan'],
 'nav-gb':['Guestbook','Guestbook'],
 'nav-about':['About','Tungkol'],
 'archive-title':['Browse all nine exhibits','Tingnan ang siyam na exhibit'],
 'arch-sub':['Read the full collection by room. Each card links to its source and the exhibit\u2019s mini-game.','Basahin ang buong koleksyon ayon sa kuwarto. Bawat card may link sa source at mini-game.'],
 'tl-label':['Drag through the decade:','I-drag ang dekada:'],
 'arc-title':['The Arcade','Ang Arcade'],
 'arc-sub':['Four bonus games from the phone in your pocket. Play any time, no stamp needed.','Apat na bonus game mula sa bulsa mo. Laroin kahit kailan, walang stamp na kailangan.'],
 'quiz-title':['Which 2000s icon are you?','Anong 2000s icon ka?'],
 'quiz-sub':['Answer 5 quick questions. We will match you to the exhibit that raised you \u2014 then generate a shareable ID card.','Sagutin ang 5 mabilis na tanong. Itutugma ka namin sa exhibit na nagpalaki sa iyo \u2014 at gagawa kami ng ID card na puwede mong i-share.'],
 'pg-title':['Time-machine playground','Palaruan ng time machine'],
 'pg-sub':['Remix yourself into the 2000s, then press play on its sounds.','I-remix ang sarili mo pabalik sa 2000s, tapos i-play ang mga tunog nito.'],
 'pb-title':['\ud83d\udcf8 2000s photo booth','\ud83d\udcf8 Photo booth ng 2000s'],
 'pb-sub':['Upload a photo (or use your camera) and get it back the 2007 way: pixelated, timestamped, Friendster-framed. Tap the photo to capture from camera.','Mag-upload ng litrato (o gamitin ang camera) at ibabalik namin itong 2007-style: pixelated, may timestamp, may Friendster frame. I-tap ang litrato para kumuha mula sa camera.'],
 'pb-choose':['Choose photo','Pumili ng litrato'],
 'pb-cam':['Use camera','Gamitin ang camera'],
 'pb-dl':['Download photo','I-download ang litrato'],
 'sb-title':['\ud83d\udd0a Soundboard','\ud83d\udd0a Soundboard'],
 'sb-sub':['Every sound synthesized live in your browser \u2014 no audio files, just WebAudio.','Bawat tunog gawa mismo sa browser mo \u2014 walang audio file, WebAudio lang.'],
 'sb-nokia':['Nokia tune','Nokia tune'],
 'sb-static':['TV static','TV static'],
 'sb-dial':['Dial-up','Dial-up'],
 'sb-sms':['Text received','May text'],
 'gb-title':['Sign the guestbook','Lumagda sa guestbook'],
 'gb-intro':['Leave a note about your favourite 2000s memory.','Mag-iwan ng mensahe tungkol sa paborito mong alaala noong 2000s.'],
 'gb-submit':['Sign the guestbook \u2192','Lumagda sa guestbook \u2192'],
 'presence-txt':['visiting right now','bumibisita ngayon'],
 'mem-title':['Community memory wall','Pader ng mga alaala'],
 'mem-sub':['Pin your own 2000s memory for every visitor to read.','I-pin ang sarili mong alaala noong 2000s para mabasa ng lahat.'],
 'mem-submit':['Pin my memory \u2192','I-pin ang alaala ko \u2192']
};
const TPH={
 'gb-name':['Your name or handle','Pangalan o handle'],
 'gb-where':['Where are you visiting from? (optional)','Taga-saan ka? (opsyonal)'],
 'gb-msg':['What do you remember from the 2000s?','Anong naaalala mo noong 2000s?'],
 'mem-name':['Your name','Pangalan mo'],
 'mem-when':['Year (e.g. 2007)','Taon (hal. 2007)'],
 'mem-msg':['Your 2000s memory\u2026','Ang alaala mo noong 2000s\u2026']
};
function applyLang(){
  for(const id in T){const el=document.getElementById(id);if(el)el.textContent=T[id][LANG==='tl'?1:0];}
  for(const id in TPH){const el=document.getElementById(id);if(el)el.placeholder=TPH[id][LANG==='tl'?1:0];}
  const b=document.getElementById('lang-toggle');
  if(b){b.classList.toggle('on',LANG==='tl');b.setAttribute('aria-pressed',LANG==='tl');}
  try{localStorage.setItem('museum-lang',LANG)}catch(e){}
  pqRender(); tlApply();
}
document.getElementById('lang-toggle').addEventListener('click',()=>{LANG=LANG==='tl'?'en':'tl';applyLang();});

/* ---------------- Quiz: which 2000s icon are you? ---------------- */
const ARCH={
 sms:{n:['The Texter','Ang Texter'],ex:'sms'},
 camera:{n:['The Documenter','Ang Documenter'],ex:'camera'},
 friendster:{n:['The Profile Curator','Ang Curator ng Profile'],ex:'friendster'},
 ofw:{n:['The Bridge','Ang Tulay'],ex:'ofw'},
 bpo:{n:['The Night Owl','Ang Night Owl'],ex:'bpo'},
 meteor:{n:['The Teleserye Devotee','Ang Teleserye Fan'],ex:'meteor'},
 boxing:{n:['The Fight Night Fan','Ang Fight Night Fan'],ex:'boxing'},
 mall:{n:['The Tambay','Ang Tambay'],ex:'mall'},
 cafe:{n:['The Piso Net Regular','Ang Suki ng Piso Net'],ex:'cafe'}
};
const PQQ=[
 {q:['It\u2019s Friday night in 2007. Where are you?','Biyernes ng gabi, 2007. Nasaan ka?'],o:[
  ['At the mall with the barkada','Sa mall kasama ang barkada','mall'],
  ['Racking up hours at the internet caf\u00e9','Nagpapalipas ng oras sa internet caf\u00e9','cafe'],
  ['Glued to the TV at home','Nakatutok sa TV sa bahay','meteor'],
  ['Texting everyone I know','Tine-text ang lahat ng kakilala','sms']]},
 {q:['Pick a sound:','Pumili ng tunog:'],o:[
  ['The Nokia tune','Ang Nokia tune','sms'],
  ['The dial-up handshake','Ang dial-up handshake','cafe'],
  ['TV static before your show','TV static bago ang palabas','meteor'],
  ['The office hum at 2AM','Ang ugong ng opisina nang 2AM','bpo']]},
 {q:['Your last \u20b120 of load goes to\u2026','Ang huling \u20b120 ng load mo ay para sa\u2026'],o:[
  ['Texting your crush','Pag-text sa crush','sms'],
  ['Updating your Friendster profile','Pag-update ng Friendster profile','friendster'],
  ['Calling family abroad','Pagtawag sa pamilya sa abroad','ofw'],
  ['MMS-ing a photo to a friend','Pag-MMS ng litrato sa kaibigan','camera']]},
 {q:['Choose a 2000s superpower:','Pumili ng 2000s superpower:'],o:[
  ['Teleporting to a Pacquiao fight','Teleport papunta sa laban ni Pacquiao','boxing'],
  ['Thriving on the night shift','Kayang-kaya ang night shift','bpo'],
  ['Finding your friends in any crowded mall','Mahanap ang barkada sa siksikang mall','mall'],
  ['A text that crosses oceans instantly','Text na tumatawid ng karagatan','ofw']]},
 {q:['Your ideal pasalubong from 2007:','Ang ideal mong pasalubong mula 2007:'],o:[
  ['A camera full of memories','Kamerang puno ng alaala','camera'],
  ['A perfectly curated profile','Perpektong profile','friendster'],
  ['An hour of uninterrupted piso net','Isang oras ng tuloy-tuloy na piso net','cafe'],
  ['The Meteor Garden finale on CD','Ang finale ng Meteor Garden sa CD','meteor']]}
];
let pqStep=0,pqScore={};
function pqRender(){
  const box=$('#pquiz'),res=$('#pq-result');
  if(pqStep>=PQQ.length){box.hidden=true;res.hidden=false;pqDraw();return;}
  box.hidden=false;res.hidden=true;
  const q=PQQ[pqStep],li=LANG==='tl'?1:0;
  $('#pq-q').textContent=(pqStep+1)+'. '+q.q[li];
  $('#pq-opts').innerHTML=q.o.map((o,i)=>'<button type="button" class="pq-opt" data-a="'+o[2]+'">'+esc2(o[li])+'</button>').join('');
  $('#pq-progress').textContent=(li?'Tanong ':'Question ')+(pqStep+1)+' / '+PQQ.length;
  $('#pq-opts').querySelectorAll('.pq-opt').forEach(b=>b.addEventListener('click',()=>{
    pqScore[b.dataset.a]=(pqScore[b.dataset.a]||0)+1;pqStep++;pqRender();
  }));
}
function pqWinner(){
  let best='sms',bs=-1;
  for(const k in ARCH){const v=pqScore[k]||0;if(v>bs){bs=v;best=k;}}
  return best;
}
function pqDraw(){
  const c=$('#pq-card'),x=c.getContext('2d'),li=LANG==='tl'?1:0;
  const w=pqWinner(),a=ARCH[w];
  let exTitle='',exYear='';
  try{exTitle=exhibits[a.ex].title;exYear=exhibits[a.ex].year;}catch(e){}
  x.fillStyle='#fffefa';x.fillRect(0,0,600,340);
  x.strokeStyle='#101927';x.lineWidth=6;x.strokeRect(8,8,584,324);
  x.fillStyle='#101927';x.fillRect(8,8,584,64);
  x.fillStyle='#fffefa';x.font='900 26px Archivo Black, Impact, sans-serif';x.textAlign='center';
  x.fillText('THE 2000s CALLED.',300,52);
  x.fillStyle='#ff835d';x.font='900 44px Archivo Black, Impact, sans-serif';
  const nm=a.n[li];x.fillText(nm.length>22?nm.slice(0,22):nm,300,140);
  x.fillStyle='#4a5a6a';x.font='16px "DM Sans", sans-serif';
  const wrap=exTitle;let line='';
  const words=String(wrap).split(' ');
  let yy=180;
  words.forEach(wd=>{if((line+' '+wd).length>44){x.fillText(line.trim(),300,yy);yy+=22;line='';}line+=' '+wd;});
  x.fillText(line.trim(),300,yy);yy+=26;
  x.fillStyle='#101927';x.font='bold 15px "Space Mono", monospace';
  x.fillText('MATCHED EXHIBIT \u00b7 '+exYear,300,yy+8);
  x.save();x.translate(480,250);x.rotate(-0.22);
  x.strokeStyle='#d33f2e';x.lineWidth=3;x.strokeRect(-110,-34,220,68);
  x.fillStyle='#d33f2e';x.font='900 20px Archivo Black, Impact, sans-serif';
  x.fillText(li?'CERTIFIED':'CERTIFIED',0,8);x.restore();
  x.fillStyle='#6b7d90';x.font='13px "Space Mono", monospace';x.textAlign='left';
  const d=new Date();
  x.fillText('Issued '+(d.getMonth()+1)+'/'+d.getDate()+'/'+d.getFullYear()+' \u00b7 the-2000s-called-museum',28,316);
}
$('#pq-dl').addEventListener('click',()=>{
  const a=document.createElement('a');
  a.download='2000s-id-card.png';a.href=$('#pq-card').toDataURL('image/png');a.click();
});
$('#pq-retry').addEventListener('click',()=>{pqStep=0;pqScore={};pqRender();});

/* ---------------- Photo booth ---------------- */
const pbC=$('#pb-canvas'),pbX=pbC.getContext('2d');
let pbImg=null,pbFilter='y2k',pbStream=null;
function pbDraw(){
  const W=480,H=360;pbX.fillStyle='#101927';pbX.fillRect(0,0,W,H);
  if(!pbImg){pbX.fillStyle='#6b7d90';pbX.font='15px "DM Sans",sans-serif';pbX.textAlign='center';pbX.fillText(LANG==='tl'?'Pumili ng litrato o gamitin ang camera':'Choose a photo or use your camera',W/2,H/2);return;}
  const ir=pbImg.width/pbImg.height,cr=W/H;
  let sw,sh,sx,sy;
  if(ir>cr){sh=pbImg.height;sw=sh*cr;sx=(pbImg.width-sw)/2;sy=0;}else{sw=pbImg.width;sh=sw/cr;sx=0;sy=(pbImg.height-sh)/2;}
  if(pbFilter==='y2k'){
    const tw=96,th=Math.round(96*H/W);
    const off=document.createElement('canvas');off.width=tw;off.height=th;
    const ox=off.getContext('2d');ox.drawImage(pbImg,sx,sy,sw,sh,0,0,tw,th);
    pbX.imageSmoothingEnabled=false;pbX.drawImage(off,0,0,tw,th,0,0,W,H);pbX.imageSmoothingEnabled=true;
    pbX.fillStyle='rgba(255,255,255,.92)';pbX.font='bold 17px "Space Mono",monospace';pbX.textAlign='right';
    pbX.fillText('07\u00b714\u00b72007',W-14,H-14);
  }else if(pbFilter==='friendster'){
    pbX.fillStyle='#fff';pbX.fillRect(0,0,W,H);
    pbX.drawImage(pbImg,sx,sy,sw,sh,24,20,W-48,H-110);
    pbX.fillStyle='#101927';pbX.font='bold 19px "DM Sans",sans-serif';pbX.textAlign='center';
    pbX.fillText('\u2665 my profile pic \u2665',W/2,H-52);
    pbX.fillStyle='#8fa4b5';pbX.font='13px "Space Mono",monospace';
    pbX.fillText('friendster.com \u00b7 2007',W/2,H-28);
  }else{ /* cctv */
    pbX.drawImage(pbImg,sx,sy,sw,sh,0,0,W,H);
    const id=pbX.getImageData(0,0,W,H),d=id.data;
    for(let i=0;i<d.length;i+=4){const g=d[i]*.3+d[i+1]*.59+d[i+2]*.11;d[i]=d[i+1]=d[i+2]=g;}
    pbX.putImageData(id,0,0);
    pbX.fillStyle='rgba(0,0,0,.16)';
    for(let y=0;y<H;y+=4)pbX.fillRect(0,y,W,2);
    pbX.fillStyle='#ff3b30';pbX.beginPath();pbX.arc(28,28,7,0,7);pbX.fill();
    pbX.fillStyle='#fff';pbX.font='bold 16px "Space Mono",monospace';pbX.textAlign='left';
    pbX.fillText('CAM 04',44,34);pbX.textAlign='right';pbX.fillText('2007-07-14 21:37',W-14,34);
  }
}
$('#pb-file').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const img=new Image();
  img.onload=()=>{pbImg=img;pbStopCam();pbDraw();URL.revokeObjectURL(img.src);};
  img.src=URL.createObjectURL(f);
});
function pbStopCam(){if(pbStream){pbStream.getTracks().forEach(t=>t.stop());pbStream=null;$('#pb-video').hidden=true;}}
function pbCamFail(){
  pbX.fillStyle='#101927';pbX.fillRect(0,0,480,360);
  pbX.fillStyle='#d33f2e';pbX.font='bold 15px "DM Sans",sans-serif';pbX.textAlign='center';
  pbX.fillText(LANG==='tl'?'Hindi ma-access ang camera':'Camera unavailable',240,150);
  pbX.fillStyle='#8fa4b5';pbX.font='13px "DM Sans",sans-serif';
  const l1=LANG==='tl'?'Kung nasa loob ka ng FB/Messenger app,':'If you are inside the FB/Messenger app,';
  const l2=LANG==='tl'?'buksan ang page sa Safari/Chrome. O':'open this page in Safari/Chrome. Or';
  const l3=LANG==='tl'?'gamitin ang \'Choose photo\'.':'use \'Choose photo\' instead.';
  pbX.fillText(l1,240,178);pbX.fillText(l2,240,198);pbX.fillText(l3,240,218);
}
$('#pb-cam').addEventListener('click',async()=>{
  if(pbStream){pbStopCam();return;}
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){pbCamFail();return;}
  try{
    pbStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}});
    const v=$('#pb-video');v.hidden=false;v.srcObject=pbStream;await v.play();
    pbX.fillStyle='#101927';pbX.fillRect(0,0,480,360);
    pbX.fillStyle='#6b7d90';pbX.font='15px "DM Sans",sans-serif';pbX.textAlign='center';
    pbX.fillText(LANG==='tl'?'I-tap ang litrato para kumuha':'Tap the photo to capture',240,180);
  }catch(err){pbCamFail();}
});
pbC.addEventListener('click',()=>{
  const v=$('#pb-video');
  if(pbStream&&!v.hidden&&v.videoWidth){pbImg=v;pbStopCam();pbDraw();}
});
document.querySelectorAll('.chip[data-f]').forEach(ch=>ch.addEventListener('click',()=>{
  document.querySelectorAll('.chip[data-f]').forEach(c=>c.classList.remove('on'));
  ch.classList.add('on');pbFilter=ch.dataset.f;pbDraw();
}));
$('#pb-dl').addEventListener('click',()=>{
  if(!pbImg)return;
  const a=document.createElement('a');a.download='2000s-photo.png';a.href=pbC.toDataURL('image/png');a.click();
});
pbDraw();

/* ---------------- Soundboard (WebAudio, synthesized) ---------------- */
let AC=null;
const ac=()=>AC||(AC=new (window.AudioContext||window.webkitAudioContext)());
function tone(f,t,d,type,g){
  const c=ac(),o=c.createOscillator(),v=c.createGain();
  o.type=type||'sine';o.frequency.value=f;
  v.gain.setValueAtTime(0.0001,t);v.gain.exponentialRampToValueAtTime(g||.18,t+.015);
  v.gain.exponentialRampToValueAtTime(0.0001,t+d);
  o.connect(v);v.connect(c.destination);o.start(t);o.stop(t+d+.05);
}
function sbNote(m){$('#sb-note').textContent=m;}
$('#sb-nokia').addEventListener('click',()=>{
  const c=ac();if(c.state==='suspended')c.resume();
  const N=[[659.25,.16],[587.33,.16],[369.99,.32],[415.30,.32],[554.37,.16],[987.77,.16],[587.33,.32],[659.25,.32],[493.88,.16],[440,.16],[277.18,.32],[329.63,.32],[440,.8]];
  let t=c.currentTime+.05;
  N.forEach(n=>{tone(n[0],t,n[1],'square',.07);t+=n[1]+.02;});
  sbNote(LANG==='tl'?'Gran Vals \u2014 ang Nokia tune':'Gran Vals \u2014 the Nokia tune');
});
$('#sb-static').addEventListener('click',()=>{
  const c=ac();if(c.state==='suspended')c.resume();
  const len=c.sampleRate*1.4,buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
  const src=c.createBufferSource();src.buffer=buf;
  const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=1800;f.Q.value=.6;
  const g=c.createGain();g.gain.setValueAtTime(.22,c.currentTime);
  g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+1.4);
  src.connect(f);f.connect(g);g.connect(c.destination);src.start();
  sbNote(LANG==='tl'?'TV static \u2014 hintay ng palabas':'TV static \u2014 waiting for the show');
});
$('#sb-dial').addEventListener('click',()=>{
  const c=ac();if(c.state==='suspended')c.resume();
  let t=c.currentTime+.05;
  tone(350,t,.35,'sine',.12);tone(440,t,.35,'sine',.12);t+=.45;
  [[1200,.07],[2200,.07],[1200,.07],[2400,.12],[1400,.07],[2400,.07],[1400,.12]].forEach(n=>{tone(n[0],t,n[1],'sine',.1);t+=n[1]+.03;});
  sbNote('56k handshake');
});
$('#sb-sms').addEventListener('click',()=>{
  const c=ac();if(c.state==='suspended')c.resume();
  const t=c.currentTime+.05;
  tone(880,t,.1,'sine',.16);tone(880,t+.16,.14,'sine',.16);
  sbNote(LANG==='tl'?'May text ka!':'You\u2019ve got text!');
});

/* ---------------- Timeline scrubber ---------------- */
function tlApply(){
  const r=$('#tl-range');if(!r)return;
  const y=r.value;$('#tl-year').textContent=y;
  let n=0;
  document.querySelectorAll('#archive .card').forEach(cd=>{
    const match=cd.dataset.year===y;n+=match?1:0;cd.classList.toggle('dim',!match);
  });
  const li=LANG==='tl'?1:0;
  $('#tl-hint').textContent=n?
    (li?n+' exhibit mula '+y+' \u2014 ang iba ay naka-dim.':n+' exhibit'+(n>1?'s':'')+' from '+y+' \u2014 the rest are dimmed.'):
    (li?'Walang exhibit mula '+y+' \u2014 subukan ang ibang taon.':'No exhibits from '+y+' \u2014 try another year.');
}
$('#tl-range').addEventListener('input',tlApply);

/* ---------------- Live presence ---------------- */
const GB_URL=(typeof GUESTBOOK_API_URL!=='undefined'&&GUESTBOOK_API_URL)?GUESTBOOK_API_URL.replace(/\/$/,''): '';
let PID='';try{PID=sessionStorage.getItem('museum-pid')||''}catch(e){}
if(!PID){PID=Math.random().toString(36).slice(2)+Date.now().toString(36);try{sessionStorage.setItem('museum-pid',PID)}catch(e){}}
async function heartbeat(){
  if(!GB_URL)return;
  try{
    await fetch(GB_URL+'/api/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:PID})});
    const r=await fetch(GB_URL+'/api/presence');
    if(r.ok){const d=await r.json();const el=$('#presence');if(el){el.hidden=false;$('#presence-count').textContent=d.count||1;}}
  }catch(e){}
}
if(GB_URL){heartbeat();setInterval(heartbeat,30000);}

/* ---------------- Community memory wall ---------------- */
const MEM_KEY='museum-memories-v1';
const memForm=$('#mem-form'),memEntries=$('#mem-entries'),memNote=$('#mem-note');
let memLive=false;
function memGet(k,d){try{const r=localStorage.getItem(k);return r?JSON.parse(r):d}catch(e){return d}}
function memSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function memRender(list){
  if(!list.length){memEntries.innerHTML='<p class="gb-empty">'+(LANG==='tl'?'\ud83d\udcfc Walang alaala pa. Ikaw ang mauna.':'\ud83d\udcfc The wall is blank. Pin the first memory.')+'</p>';return;}
  memEntries.innerHTML=list.slice().reverse().map(e=>
    '<div class="gb-entry"><div class="gb-who">'+esc2(e.who)+(e.when?' \u00b7 '+esc2(e.when):'')+'</div><p class="gb-msg">'+esc2(e.msg)+'</p></div>'
  ).join('');
}
function memLocal(){$('#mem-note').hidden=false;$('#mem-note').textContent=LANG==='tl'?'Hindi maabot ang server \u2014 mga alaala mula sa device na ito.':'Server unreachable \u2014 showing memories from this device.';memRender(memGet(MEM_KEY,[]));}
async function memLoad(){
  if(!GB_URL){memLocal();return;}
  try{
    const r=await fetch(GB_URL+'/api/memories');if(!r.ok)throw 0;
    const list=await r.json();memLive=true;$('#mem-note').hidden=true;
    const server=Array.isArray(list)?list:[];
    const gk=e=>[e.who||'',e.when||'',e.msg||''].join('¦');
    const seen=new Set(server.map(gk));
    const onlyLocal=memGet(MEM_KEY,[]).filter(e=>!seen.has(gk(e)));
    memRender(server.concat(onlyLocal));
    if(onlyLocal.length){
      try{
        for(const e of onlyLocal){
          const pr=await fetch(GB_URL+'/api/memories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({who:e.who,when:e.when,msg:e.msg})});
          if(!pr.ok)throw 0;
        }
        memSet(MEM_KEY,[]);
        const r2=await fetch(GB_URL+'/api/memories');
        if(r2.ok){const l2=await r2.json();memRender(Array.isArray(l2)?l2:[]);}
      }catch(_){}
    }
  }catch(e){memLocal();}
}
memForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const who=$('#mem-name').value.trim(),when=$('#mem-when').value.trim(),msg=$('#mem-msg').value.trim();
  if(!who||!msg)return;
  const btn=memForm.querySelector('button[type="submit"]');
  btn.disabled=true;
  try{
    if(memLive){
      const r=await fetch(GB_URL+'/api/memories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({who,when,msg})});
      if(!r.ok)throw 0;await r.json();await memLoad();
    }else{const l=memGet(MEM_KEY,[]);l.push({who,when,msg,ts:Date.now()});memSet(MEM_KEY,l);memLocal();}
    memForm.reset();
  }catch(err){const l=memGet(MEM_KEY,[]);l.push({who,when,msg,ts:Date.now()});memSet(MEM_KEY,l);memLocal();memForm.reset();}
  finally{btn.disabled=false;}
});

/* ---------------- init ---------------- */
applyLang();
memLoad();
})();
