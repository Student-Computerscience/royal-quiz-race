import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const rooms = new Map();

const bank = [
  {q:'Which Indian state is especially famous for Kanchipuram silk sarees?',o:['Tamil Nadu','Punjab','Assam','Goa'],a:0},
  {q:'What is the capital of Rajasthan?',o:['Jaipur','Jodhpur','Udaipur','Ajmer'],a:0},
  {q:'Which river flows through Varanasi?',o:['Ganga','Godavari','Narmada','Kaveri'],a:0},
  {q:'Which spice gives many biryanis their golden colour?',o:['Turmeric','Cinnamon','Pepper','Clove'],a:0},
  {q:'The classical dance form Kathakali comes from which state?',o:['Kerala','Bihar','Gujarat','Sikkim'],a:0},
  {q:'Which Indian state is known as the Land of Five Rivers?',o:['Punjab','Haryana','Uttar Pradesh','Madhya Pradesh'],a:0},
  {q:'What is the main ingredient in dhokla?',o:['Gram flour','Rice flour','Wheat flour','Coconut'],a:0},
  {q:'Which is the highest mountain peak located entirely in India?',o:['Nanda Devi','Anamudi','Guru Shikhar','Doddabetta'],a:0},
  {q:'Onam is a major harvest festival in which state?',o:['Kerala','Maharashtra','Odisha','Nagaland'],a:0},
  {q:'Which city is often called the Pink City?',o:['Jaipur','Jaisalmer','Bhopal','Lucknow'],a:0},
  {q:'What is the name of the traditional Assamese silk?',o:['Muga','Pashmina','Kosa','Patola'],a:0},
  {q:'Which Indian state has the longest coastline?',o:['Gujarat','Tamil Nadu','Andhra Pradesh','Maharashtra'],a:0},
  {q:'Sambhar is a popular dish usually served with what?',o:['Idli','Roti','Dhokla','Litti'],a:0},
  {q:'The Sun Temple at Konark is in which state?',o:['Odisha','West Bengal','Jharkhand','Chhattisgarh'],a:0},
  {q:'Which lake in Manipur is famous for floating islands called phumdis?',o:['Loktak Lake','Dal Lake','Chilika Lake','Wular Lake'],a:0},
  {q:'What is the traditional Gujarati embroidered textile called?',o:['Bandhani','Chikankari','Phulkari','Kalamkari'],a:0},
  {q:'Which city is the capital of Meghalaya?',o:['Shillong','Aizawl','Kohima','Imphal'],a:0},
  {q:'Pongal is a harvest festival celebrated mainly in which state?',o:['Tamil Nadu','Rajasthan','Uttarakhand','Tripura'],a:0},
  {q:'Which Indian sweet is made mainly from chhena and soaked in syrup?',o:['Rasgulla','Jalebi','Mysore pak','Peda'],a:0},
  {q:'The Thar Desert is mostly located in which Indian state?',o:['Rajasthan','Assam','Kerala','Bihar'],a:0}
];

const json = (res, status, data) => { res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'}); res.end(JSON.stringify(data)); };
const code = () => { let s=''; do { s=Array.from({length:4},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random()*24)]).join(''); } while(rooms.has(s)); return s; };
function publicRoom(room, token) {
  const me = room.players.find(p=>p.token===token);
  const players = room.players.map(p=>({id:p.token,name:p.name,host:p.token===room.host,spectator:p.spectator,score:p.score,connected:Date.now()-p.seen<12000,answer: room.phase==='reveal' ? (p.answer===null?null:p.answer===room.questions[room.index]?.a) : null,used:room.phase==='reveal'?p.usedThisQ:null,answered:room.phase==='question'&&p.answer!==null})).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
  const q=room.questions[room.index];
  return {code:room.code,players,me:me?{id:me.token,name:me.name,host:me.token===room.host,spectator:me.spectator,score:me.score,answer:me.answer,used:me.used}:null,phase:room.phase,index:room.index,total:10,question:q?{q:q.q,options:q.o,answer:room.phase==='reveal'?q.a:null,hiddenOptions:me?.hiddenOptions||[]}:null,endsAt:room.endsAt,usedPlayers:room.phase==='reveal'?room.players.filter(p=>p.usedThisQ).map(p=>({name:p.name,used:p.usedThisQ})):[],winner:room.winner||null,error:null};
}
function changePhase(room) {
  if (room.phase==='question' && Date.now()>=room.endsAt) { room.phase='reveal'; room.endsAt=Date.now()+5000; }
  else if (room.phase==='reveal' && Date.now()>=room.endsAt) {
    if(room.index>=9){ room.phase='finished'; room.winner=[...room.players].sort((a,b)=>b.score-a.score)[0]?.name||null; room.endsAt=0; }
    else { room.index++; room.phase='question'; room.endsAt=Date.now()+10000; for(const p of room.players){p.answer=null;p.usedThisQ=null;p.hiddenOptions=[];} }
  }
}
async function body(req) { let s=''; for await (const chunk of req) s+=chunk; try{return JSON.parse(s||'{}')}catch{return {}} }
export async function handle(req,res){
  const url=new URL(req.url,'http://localhost');
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});return res.end();}
  if(url.pathname.startsWith('/api/')){
    const data= req.method==='POST'?await body(req):{};
    if(req.method==='POST'&&url.pathname==='/api/create'){
      const token=randomBytes(18).toString('hex'), c=code(), name=String(data.name||'').trim().slice(0,18)||'Host';
      const room={code:c,created:Date.now(),host:token,players:[{token,name,seen:Date.now(),score:0,answer:null,used:{double:false,half:false},usedThisQ:null,spectator:false}],phase:'lobby',index:-1,questions:[],endsAt:0}; rooms.set(c,room); return json(res,200,{...publicRoom(room,token),token});
    }
    if(req.method==='POST'&&url.pathname==='/api/join'){
      const c=String(data.code||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4), room=rooms.get(c); if(!room)return json(res,404,{error:'Room not found. Check the 4-letter code.'});
      const name=String(data.name||'').trim().slice(0,18); if(!name)return json(res,400,{error:'Please enter a nickname.'});
      let p=data.token&&room.players.find(x=>x.token===data.token);
      if(p){p.name=name;p.seen=Date.now();} else {if(room.players.some(x=>x.name.toLowerCase()===name.toLowerCase()))return json(res,409,{error:'That nickname is already in this room. Choose another.'}); p={token:randomBytes(18).toString('hex'),name,seen:Date.now(),score:0,answer:null,used:{double:false,half:false},usedThisQ:null,spectator:room.phase!=='lobby'};room.players.push(p);}
      return json(res,200,{...publicRoom(room,p.token),token:p.token});
    }
    const c=String(url.searchParams.get('code')||data.code||'').toUpperCase(), room=rooms.get(c), token=String(url.searchParams.get('token')||data.token||'');
    if(!room)return json(res,404,{error:'Room not found. It may have closed.'});
    if(req.method==='GET'&&url.pathname==='/api/state') {const p=room.players.find(x=>x.token===token);if(!p)return json(res,403,{error:'You are not in this room. Join again.'});p.seen=Date.now();changePhase(room);return json(res,200,publicRoom(room,token));}
    const p=room.players.find(x=>x.token===token); if(!p)return json(res,403,{error:'Please join this room first.'});p.seen=Date.now();
    if(url.pathname==='/api/start') {if(token!==room.host)return json(res,403,{error:'Only the host can start.'});if(room.phase!=='lobby')return json(res,400,{error:'The game has already started.'});if(room.players.filter(x=>!x.spectator).length<2)return json(res,400,{error:'You need at least 2 players to start.'});room.questions=[...bank].sort(()=>Math.random()-.5).slice(0,10).map((q)=>{const options=[...q.o], correct=options[0];options.sort(()=>Math.random()-.5);return {...q,o:options,a:options.indexOf(correct)};});room.index=0;room.phase='question';room.endsAt=Date.now()+10000;return json(res,200,publicRoom(room,token));}
    if(url.pathname==='/api/answer') {changePhase(room);if(room.phase!=='question'||p.spectator)return json(res,400,{error:'This question is closed.'});if(p.answer!==null)return json(res,400,{error:'You already answered.'});const n=Number(data.answer);if(!Number.isInteger(n)||n<0||n>3)return json(res,400,{error:'Pick one of the four answers.'});p.answer=n; if(n===room.questions[room.index].a){const remaining=Math.max(0,room.endsAt-Date.now());p.score+=Math.round(1000*remaining/10000)*(p.used.double?2:1);}return json(res,200,publicRoom(room,token));}
    if(url.pathname==='/api/power') {if(room.phase!=='question'||p.spectator||p.answer!==null)return json(res,400,{error:'Power-ups are available before you answer.'});const type=data.type;if(!['double','half'].includes(type)||p.used[type])return json(res,400,{error:'That power-up has already been used.'});p.used[type]=true;p.usedThisQ=type;if(type==='half'){const wrong=[0,1,2,3].filter(i=>i!==room.questions[room.index].a);p.hiddenOptions=wrong.sort(()=>Math.random()-.5).slice(0,2);}return json(res,200,publicRoom(room,token));}
    if(url.pathname==='/api/replay') {if(room.phase!=='finished'||token!==room.host)return json(res,403,{error:'Only the host can start another game.'});for(const x of room.players){x.score=0;x.answer=null;x.used={double:false,half:false};x.usedThisQ=null;x.hiddenOptions=[];x.spectator=false;}room.winner=null;room.questions=[];room.index=-1;room.phase='lobby';room.endsAt=0;return json(res,200,publicRoom(room,token));}
    return json(res,404,{error:'Unknown action.'});
  }
  let requested=decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.slice(1));let file=path.resolve(here,'public',requested);if(!file.startsWith(path.resolve(here,'public')+path.sep)){res.writeHead(403);return res.end('Forbidden');}fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);res.end('Not found');return;}const type=file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html';res.writeHead(200,{'content-type':`${type}; charset=utf-8`});res.end(b);});
}

const server=http.createServer(handle);
const isMain=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(isMain){
  setInterval(()=>{ for(const room of rooms.values()){ changePhase(room); const alive=room.players.filter(p=>Date.now()-p.seen<20000); if(!alive.some(p=>p.token===room.host)&&alive.length) room.host=alive[0].token; if(!room.players.length && Date.now()-room.created>3600000) rooms.delete(room.code); } },250);
  server.listen(PORT,HOST,()=>console.log(`Royal Quiz Race running at http://localhost:${PORT}`));
}
