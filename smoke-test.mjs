// Run with `npm test`. Simulate two players through a full race without waiting for clocks.
const { handle } = await import('./server.mjs');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const realNow = Date.now;
let testNow = realNow();
Date.now = () => testNow;
async function request(path, data) {
  const req={url:path,method:data?'POST':'GET',async *[Symbol.asyncIterator](){if(data)yield Buffer.from(JSON.stringify(data));}};
  const result={status:200,body:''};
  const res={writeHead(status){result.status=status;},end(body=''){result.body=String(body);}};
  await handle(req,res);
  return {status:result.status,data:result.body?JSON.parse(result.body):null};
}
try {
  const host=(await request('/api/create',{name:'Asha'})).data;
  assert((await request('/api/join',{code:'ZZZZ',name:'Guest'})).status===404,'Bad room code should be rejected.');
  const guest=await request('/api/join',{code:host.code,name:'Dev'});
  assert(guest.status===200,'Second player should join.');
  assert((await request('/api/join',{code:host.code,name:'asha'})).status===409,'Duplicate nickname should be rejected.');
  const start=await request('/api/start',{code:host.code,token:host.token});
  assert(start.status===200,'Host should start with two players.');
  const otherView=await request(`/api/state?code=${host.code}&token=${guest.data.token}`);
  assert(start.data.question.q===otherView.data.question.q,'Both players should get the same question.');
  const half=await request('/api/power',{code:host.code,token:guest.data.token,type:'half'});
  assert(half.status===200&&half.data.question.hiddenOptions.length===2,'50-50 should remove two choices.');
  const doubled=await request('/api/power',{code:host.code,token:host.token,type:'double'});
  assert(doubled.status===200&&doubled.data.me.used.double,'Double Gold should activate.');
  const availableAnswer=[0,1,2,3].find(index=>!half.data.question.hiddenOptions.includes(index));
  assert((await request('/api/answer',{code:host.code,token:guest.data.token,answer:availableAnswer})).status===200,'Guest answer should submit.');
  assert((await request('/api/answer',{code:host.code,token:host.token,answer:0})).status===200,'Host answer should submit.');
  testNow+=10001;
  const reveal=await request(`/api/state?code=${host.code}&token=${host.token}`);
  assert(reveal.data.phase==='reveal'&&Number.isInteger(reveal.data.question.answer),'Reveal should show the correct answer.');
  assert(reveal.data.usedPlayers.length===2,'Reveal should show power-up use.');
  assert((await request(`/api/state?code=${host.code}&token=${guest.data.token}`)).status===200,'Player token should reconnect after refresh.');
  const late=await request('/api/join',{code:host.code,name:'Latecomer'});
  assert(late.status===200&&late.data.me.spectator,'Late joiner should watch until the next game.');
  for(let nextIndex=1;nextIndex<10;nextIndex++){
    testNow+=5001;
    const next=await request(`/api/state?code=${host.code}&token=${host.token}`);
    assert(next.data.phase==='question'&&next.data.index===nextIndex,`Question ${nextIndex+1} should start for everyone.`);
    for(const player of [host,guest.data])assert((await request('/api/answer',{code:host.code,token:player.token,answer:0})).status===200,'Each player should answer each question.');
    testNow+=10001;
    const after=await request(`/api/state?code=${host.code}&token=${host.token}`);
    assert(after.data.phase==='reveal'&&after.data.index===nextIndex,'Each question should reveal before continuing.');
  }
  testNow+=5001;
  const finished=await request(`/api/state?code=${host.code}&token=${host.token}`);
  assert(finished.data.phase==='finished'&&finished.data.winner,'The tenth question should end with a winner.');
  const replay=await request('/api/replay',{code:host.code,token:host.token});
  assert(replay.status===200&&replay.data.phase==='lobby'&&replay.data.me.host,'Host should be able to start a new race.');
  assert(replay.data.players.every(player=>player.score===0&&!player.spectator),'Replay should reset scores and promote watchers.');
  console.log('PASS: two players, 10 questions, powers, errors, refresh, spectator, winner, and replay.');
} finally { Date.now=realNow; }
