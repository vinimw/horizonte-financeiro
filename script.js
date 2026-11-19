/* Horizonte · Simulador financeiro mensal · sem dependências */
(() => {
  'use strict';
  const STORAGE_KEY = 'horizonte-financeiro-v1';
  const SAVED_KEY = 'horizonte-financeiro-scenarios-v1';
  const MAX_SCENARIOS = 50;
  const TYPE_NAMES = {expense:'Novo gasto mensal',income:'Novo salário mensal',extraIn:'Recebimento único',extraOut:'Gasto único'};
  const SAMPLE = {
    balance: '0', income: '12000', expenses: '14000', rate: '8', startMonth: '2026-12',
    changes: [
      {id:1,name:'Redução dos gastos mensais',type:'expense',date:'2027-02-15',amount:'6000'},
      {id:2,name:'Aumento dos gastos mensais',type:'expense',date:'2027-05-10',amount:'9000'},
    ],
  };
  const moneyFmt = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const dom = id => document.getElementById(id);
  const cloneSample = () => JSON.parse(JSON.stringify(SAMPLE));
  const escapeHtml = str => String(str).replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const money = n => moneyFmt.format(Number.isFinite(n) ? n : 0);
  const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const min0 = n => Math.max(0,n);
  const parseNumber = raw => {
    let s = String(raw ?? '').trim().replace(/[^\d,.\-]/g,'');
    if(!s || s==='-') return 0;
    if(s.includes(',')) s = s.replace(/\./g,'').replace(',','.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g,'');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  const monthOf = date => date.slice(0,7);
  const formatMonth = value => {
    const [year,month] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year,month-1,1))).replace('.','');
  };
  function validMonth(m){ return typeof m==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m); }
  function validDate(d){
    if(typeof d!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const date = new Date(`${d}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===d;
  }
  function normalize(raw){
    const defaults = cloneSample();
    if(!raw || typeof raw!=='object')return defaults;
    const out = {};
    for(const key of ['balance','income','expenses','rate'])out[key] = typeof raw[key]==='string'||typeof raw[key]==='number' ? String(raw[key]).slice(0,50) : defaults[key];
    out.startMonth = validMonth(raw.startMonth) ? raw.startMonth : defaults.startMonth;
    out.changes = Array.isArray(raw.changes) ? raw.changes.slice(0,250).filter(e => e && typeof e==='object' && validDate(e.date) && TYPE_NAMES[e.type] && Number.isFinite(parseNumber(e.amount)) && parseNumber(e.amount)>=0).map((e,i)=>({id:i+1,name:String(e.name||TYPE_NAMES[e.type]).slice(0,90),type:e.type,date:e.date,amount:String(e.amount).slice(0,50)})) : defaults.changes;
    return out;
  }
  let state = cloneSample();
  try {const stored=localStorage.getItem(STORAGE_KEY);if(stored)state=normalize(JSON.parse(stored));}catch(e){/* storage optional */}
  let months = [];
  let selectedMonth = 0;
  let savedScenarios = [];
  try {
    const raw=localStorage.getItem(SAVED_KEY);
    if(raw){
      const entries=JSON.parse(raw);
      if(Array.isArray(entries))savedScenarios=entries.slice(0,MAX_SCENARIOS).filter(x=>x&&typeof x==='object'&&x.data&&Array.isArray(x.data.changes))
        .map((x,i)=>({id:String(x.id||`imported-${i}`).slice(0,90),name:String(x.name||`Cenário ${i+1}`).slice(0,70),createdAt:String(x.createdAt||'').slice(0,40),data:normalize(x.data)}));
    }
  }catch(e){/* Browser storage unavailable or invalid */}
  let compareA='current',compareB=savedScenarios[0]?.id||'current';

  function simulate(inputs) {
    const start = inputs.startMonth;
    const initial = parseNumber(inputs.balance);
    const monthlyRate = Math.min(1,min0(parseNumber(inputs.rate)/100));
    let saldo = initial;
    let pendingAdditionalIof = 0;
    let totalInterest = 0, totalIof = 0, totalIncome = 0, totalExpenses = 0;
    const events = [...inputs.changes].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
    const [startYear,startMonth] = start.split('-').map(Number);
    const rows=[];
    for(let index=0;index<12;index++){
      const year=startYear+Math.floor((startMonth-1+index)/12);
      const month=(startMonth-1+index)%12+1;
      const period=`${year}-${String(month).padStart(2,'0')}`;
      const monthEnd=`${period}-${new Date(Date.UTC(year,month,0)).getUTCDate()}`;
      const days=new Date(Date.UTC(year,month,0)).getUTCDate();
      let income=min0(parseNumber(inputs.income));
      let expenses=min0(parseNumber(inputs.expenses));
      for(const e of events){
        if(e.date>monthEnd)break;
        if(e.type==='income')income=min0(parseNumber(e.amount));
        if(e.type==='expense')expenses=min0(parseNumber(e.amount));
      }
      const activeEvents = events.filter(e=>monthOf(e.date)===period);
      const extraIncome = round(activeEvents.filter(e=>e.type==='extraIn').reduce((sum,e)=>sum+min0(parseNumber(e.amount)),0));
      const extraExpenses = round(activeEvents.filter(e=>e.type==='extraOut').reduce((sum,e)=>sum+min0(parseNumber(e.amount)),0));
      const incoming=round(income+extraIncome), outgoing=round(expenses+extraExpenses);
      const opening=saldo;
      const startingDebt=min0(-opening);
      const interest=round(startingDebt*monthlyRate);
      const dailyIof=round(startingDebt*0.000082*days);
      const additionalIof=round(pendingAdditionalIof);
      const cashFlow=round(incoming-outgoing);
      const closingBeforeFees=round(opening+cashFlow);
      const newCreditUse=min0(min0(-closingBeforeFees)-startingDebt);
      const nextAdditionalIof=round(newCreditUse*0.0038);
      saldo=round(closingBeforeFees-interest-dailyIof-additionalIof);
      pendingAdditionalIof=nextAdditionalIof;
      totalInterest+=interest;totalIof+=dailyIof+additionalIof;totalIncome+=incoming;totalExpenses+=outgoing;
      rows.push({index,period,label:formatMonth(period),days,opening,income,expenses,extraIncome,extraExpenses,incoming,outgoing,cashFlow,startingDebt,interest,dailyIof,additionalIof,closingBeforeFees,closing:saldo,nextAdditionalIof,activeEvents});
    }
    return {initial,rows,final:saldo,variation:round(saldo-initial),totalIncome:round(totalIncome),totalExpenses:round(totalExpenses),totalInterest:round(totalInterest),totalIof:round(totalIof),pendingAdditionalIof:pendingAdditionalIof};
  }
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(e){/* storage disabled */}}
  function syncForm(){for(const field of ['balance','income','expenses','rate','startMonth'])dom(field).value=state[field];}
  function renderEvents(){
    const el=dom('events');
    el.replaceChildren();
    if(state.changes.length===0){
      const empty=document.createElement('p');empty.className='help';empty.textContent='Nenhuma mudança cadastrada.';el.append(empty);return;
    }
    const ordered=[...state.changes].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
    for(const item of ordered){
      const card=document.createElement('div');card.className='event-card';
      const line=document.createElement('div');line.className='event-line';
      const description=document.createElement('div');
      const title=document.createElement('div');title.className='event-name';title.textContent=item.name;
      const date=document.createElement('div');date.className='event-date';date.textContent=`${item.date.slice(8,10)}/${item.date.slice(5,7)}/${item.date.slice(0,4)} · vale ${item.type==='income'||item.type==='expense'?'desde o início de '+formatMonth(monthOf(item.date)):'somente neste mês'}`;
      description.append(title,date);
      const remove=document.createElement('button');remove.type='button';remove.className='event-remove';remove.textContent='×';remove.setAttribute('aria-label',`Excluir ${item.name}`);
      remove.addEventListener('click',()=>{state.changes=state.changes.filter(e=>e.id!==item.id);update();});
      line.append(description,remove);
      const value=document.createElement('div');value.className='event-value';value.textContent=money(min0(parseNumber(item.amount)));
      const type=document.createElement('div');type.className='event-type';type.textContent=TYPE_NAMES[item.type];
      card.append(line,value,type);el.append(card);
    }
  }
  function setText(id,text){dom(id).textContent=text;}
  function renderSummary(sim){
    const balanceEl=dom('finalBalance');balanceEl.textContent=money(sim.final);balanceEl.classList.toggle('negative',sim.final<0);
    setText('balanceDelta',`${sim.variation>=0?'+':''}${money(sim.variation)} de variação em relação ao saldo inicial`);
    setText('totalIncome',money(sim.totalIncome));setText('totalExpenses',money(sim.totalExpenses));setText('totalInterest',money(sim.totalInterest));setText('totalIof',money(sim.totalIof));
    const positive=sim.rows.find(r=>r.closing>=0);
    const insight=dom('insight');insight.classList.toggle('bad',sim.final<0);
    insight.replaceChildren();const ico=document.createElement('span');ico.className='insight-icon';ico.textContent=sim.final<0?'!':'✓';const content=document.createElement('span');
    if(sim.final<0)content.textContent=`A projeção termina com ${money(Math.abs(sim.final))} de saldo devedor. Ajuste as despesas ou a renda para simular uma recuperação.`;
    else if(sim.initial<0&&positive)content.textContent=`Boa evolução: o primeiro fechamento positivo está previsto para ${positive.label}. O saldo final é de ${money(sim.final)}.`;
    else content.textContent=`A projeção termina com saldo positivo de ${money(sim.final)}. Teste mudanças nas despesas para comparar cenários.`;
    insight.append(ico,content);
  }
  function svgEl(tag,attrs={},text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));if(text!==undefined)el.textContent=text;return el;}
  function renderChart(sim){
    const holder=dom('chart');holder.replaceChildren();
    const W=760,H=255,L=78,R=23,T=16,B=33;
    const values=[sim.initial,...sim.rows.map(r=>r.closing)];
    const minVal=Math.min(0,...values),maxVal=Math.max(0,...values);
    const range=Math.max(2500,maxVal-minVal);
    const high=maxVal+range*.12,low=minVal-range*.12;
    const x=i=>L+(W-L-R)*i/(values.length-1);
    const y=v=>T+(H-T-B)*(high-v)/(high-low);
    const svg=svgEl('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'Gráfico de linha com saldo inicial e doze fechamentos mensais'});
    const defs=svgEl('defs');const grad=svgEl('linearGradient',{id:'chartFill',x1:'0',x2:'0',y1:'0',y2:'1'});grad.append(svgEl('stop',{offset:'0%','stop-color':'#17b890','stop-opacity':'.18'}),svgEl('stop',{offset:'100%','stop-color':'#17b890','stop-opacity':'.01'}));defs.append(grad);svg.append(defs);
    for(let t=0;t<=4;t++){
      const val=low+(high-low)*(1-t/4),Y=y(val);
      svg.append(svgEl('line',{x1:L,y1:Y,x2:W-R,y2:Y,stroke:'#eaf0f4','stroke-width':1}));
      const label=svgEl('text',{x:L-11,y:Y+4,'text-anchor':'end',class:'axis-label'},new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val));svg.append(label);
    }
    if(low<0&&high>0)svg.append(svgEl('line',{x1:L,y1:y(0),x2:W-R,y2:y(0),stroke:'#cbd4df','stroke-width':1.3,'stroke-dasharray':'5 5'}));
    const points=values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');
    const area=`M ${x(0)} ${H-B} L ${points.replace(/ /g,' L ')} L ${x(values.length-1)} ${H-B} Z`;
    svg.append(svgEl('path',{d:area,fill:'url(#chartFill)'}));
    svg.append(svgEl('polyline',{points,class:'chart-line'}));
    for(let i=0;i<values.length;i++){
      const dot=svgEl('circle',{cx:x(i),cy:y(values[i]),r:i===values.length-1?5:3.5,class:'chart-dot'});
      dot.append(svgEl('title',{},`${i===0?'Saldo inicial':sim.rows[i-1].label}: ${money(values[i])}`));svg.append(dot);
      if(i%2===0||i===values.length-1){let label=i===0?'Inicial':sim.rows[i-1].label.split(' ')[0];svg.append(svgEl('text',{x:x(i),y:H-11,'text-anchor':'middle',class:'axis-label'},label));}
    }
    holder.append(svg);
  }
  function renderTable(sim){
    const body=dom('months');body.replaceChildren();
    for(const r of sim.rows){
      const tr=document.createElement('tr');tr.dataset.index=String(r.index);if(r.index===selectedMonth)tr.classList.add('selected');
      const row=[r.label,money(r.incoming),money(r.outgoing),money(r.interest),money(r.dailyIof+r.additionalIof),money(r.closing),'›'];
      row.forEach((v,i)=>{const td=document.createElement('td');td.textContent=v;if(i===0)td.className='month';if(i===5)td.className=r.closing>=0?'value-positive':'value-negative';if(i===6)td.className='details-link';tr.append(td);});
      tr.addEventListener('click',()=>{selectedMonth=r.index;renderTable(sim);renderBreakdown(sim);dom('details').scrollIntoView({behavior:'smooth',block:'nearest'});});body.append(tr);
    }
  }
  function renderBreakdown(sim){
    selectedMonth=Math.min(11,Math.max(0,selectedMonth));const r=sim.rows[selectedMonth];
    const selector=dom('monthSelect');selector.replaceChildren();for(const month of sim.rows){const option=document.createElement('option');option.value=String(month.index);option.textContent=month.label;selector.append(option);}selector.value=String(selectedMonth);
    const rows=[
      ['Saldo anterior',r.opening,false],['Salário mensal',r.income,true],['Recebimentos únicos',r.extraIncome,true],['Gasto mensal',r.expenses,false],['Gastos únicos',r.extraExpenses,false],['Juros do cheque especial',r.interest,false],['IOF diário estimado',r.dailyIof,false],['IOF adicional do período anterior',r.additionalIof,false]
    ];
    const breakdown=document.createElement('div');breakdown.className='breakdown';
    rows.forEach(([label,value,positive])=>{const line=document.createElement('div');line.className='breakdown-row';const name=document.createElement('span');name.textContent=label;const amount=document.createElement('strong');amount.textContent=label==='Saldo anterior'?money(value):`${positive?'+':'−'} ${money(value)}`;if(positive&&value)amount.style.color='#058f72';line.append(name,amount);breakdown.append(line);});
    const last=document.createElement('div');last.className='breakdown-row final';const name=document.createElement('strong');name.textContent='Saldo final';const value=document.createElement('strong');value.textContent=money(r.closing);value.style.color=r.closing<0?'#d34e60':'#058f72';last.append(name,value);breakdown.append(last);
    const notes=document.createElement('p');notes.className='breakdown-notes';
    notes.textContent=`Encargos estimados: ${money(r.startingDebt)} de dívida inicial × ${parseNumber(state.rate)}% = ${money(r.interest)} em juros; ${money(r.startingDebt)} × 0,0082% × ${r.days} dias = ${money(r.dailyIof)} de IOF diário. IOF adicional previsto para o mês seguinte: ${money(r.nextAdditionalIof)}.`;
    const holder=dom('breakdown');holder.replaceChildren(breakdown,notes);
    if(r.activeEvents.length){const events=document.createElement('p');events.className='breakdown-notes';events.textContent=`Alterações deste mês: ${r.activeEvents.map(e=>`${e.name} (${money(parseNumber(e.amount))})`).join(' · ')}`;holder.append(events);}
  }
  function cloneState(input){return normalize(JSON.parse(JSON.stringify(input)));}
  function persistSaved(){
    try{localStorage.setItem(SAVED_KEY,JSON.stringify(savedScenarios));return true;}
    catch(e){return false;}
  }
  function scenarioName(id){return id==='current'?'Simulação atual':savedScenarios.find(s=>s.id===id)?.name||'Cenário não encontrado';}
  function scenarioData(id){return id==='current'?state:savedScenarios.find(s=>s.id===id)?.data||state;}
  function scenarioDate(value){
    if(!value)return 'Data não informada';
    const d=new Date(value);if(!Number.isFinite(d.getTime()))return 'Data não informada';
    return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
  }
  function renderSaved(){
    setText('savedCount',String(savedScenarios.length));
    const holder=dom('savedScenarios');holder.replaceChildren();
    if(savedScenarios.length===0){const note=document.createElement('div');note.className='scenario-empty';note.textContent='Nenhuma versão salva. Preencha um nome e clique em “Salvar versão atual”.';holder.append(note);return;}
    for(const scenario of savedScenarios){
      const sim=simulate(scenario.data);
      const item=document.createElement('div');item.className='saved-card';
      const head=document.createElement('div');head.className='saved-card-head';
      const title=document.createElement('div');
      const name=document.createElement('h3');name.textContent=scenario.name;
      const date=document.createElement('time');date.textContent=scenarioDate(scenario.createdAt);
      title.append(name,date);head.append(title);
      const final=document.createElement('strong');final.textContent=money(sim.final);final.className=sim.final<0?'value-negative':'value-positive';
      const description=document.createElement('p');description.textContent=`${scenario.data.startMonth} · 12 meses · ${scenario.data.changes.length} mudanças`;
      const buttons=document.createElement('div');buttons.className='saved-actions';
      const load=document.createElement('button');load.type='button';load.textContent='Carregar';load.title=`Carregar ${scenario.name} na calculadora`;
      load.addEventListener('click',()=>{
        if(!window.confirm(`Carregar “${scenario.name}”? Alterações ainda não salvas na simulação atual serão substituídas.`))return;
        state=cloneState(scenario.data);selectedMonth=0;syncForm();update();toast(`Cenário “${scenario.name}” carregado.`);
      });
      const compare=document.createElement('button');compare.type='button';compare.textContent='Comparar';compare.title=`Comparar a simulação atual com ${scenario.name}`;
      compare.addEventListener('click',()=>{compareA='current';compareB=scenario.id;renderCompare();dom('comparePanel').scrollIntoView({behavior:'smooth',block:'start'});});
      const remove=document.createElement('button');remove.type='button';remove.className='delete';remove.textContent='Excluir';remove.title=`Excluir ${scenario.name}`;
      remove.addEventListener('click',()=>{
        if(!window.confirm(`Excluir o cenário salvo “${scenario.name}”? Esta ação não pode ser desfeita.`))return;
        const old=savedScenarios;savedScenarios=old.filter(s=>s.id!==scenario.id);
        if(!persistSaved()){savedScenarios=old;toast('Não foi possível excluir. Verifique o armazenamento do navegador.');return;}
        if(compareA===scenario.id)compareA='current';if(compareB===scenario.id)compareB=savedScenarios[0]?.id||'current';
        renderSaved();renderCompare();toast('Cenário excluído.');
      });
      buttons.append(load,compare,remove);item.append(head,final,description,buttons);holder.append(item);
    }
  }
  function compareMetric(holder,title,a,b,inverse=false){
    const delta=round(b-a);
    const item=document.createElement('div');item.className='comparison-stat';
    item.classList.add(delta===0?'neutral':(inverse?delta<0:delta>0)?'good':'bad');
    const label=document.createElement('span');label.textContent=title;
    const value=document.createElement('strong');value.textContent=`${delta>0?'+':''}${money(delta)}`;
    const detail=document.createElement('small');detail.textContent=`A: ${money(a)}  ·  B: ${money(b)}`;
    item.append(label,value,detail);holder.append(item);
  }
  function renderCompareChart(a,b){
    const holder=dom('compareChart');holder.replaceChildren();
    const monthMap=new Map();
    for(const r of a.rows){monthMap.set(r.period,{a:r.closing,b:null});}
    for(const r of b.rows){const entry=monthMap.get(r.period)||{a:null,b:null};entry.b=r.closing;monthMap.set(r.period,entry);}
    const entries=[...monthMap.entries()].sort((x,y)=>x[0].localeCompare(y[0]));
    const W=760,H=225,L=78,R=24,T=15,B=33;
    const values=entries.flatMap(([,v])=>[v.a,v.b].filter(x=>x!==null));
    const lo=Math.min(0,...values),hi=Math.max(0,...values),pad=Math.max(2000,hi-lo)*.13;
    const low=lo-pad,high=hi+pad;
    const x=i=>L+(W-L-R)*(entries.length>1?i/(entries.length-1):.5);
    const y=v=>T+(H-T-B)*(high-v)/(high-low);
    const svg=svgEl('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'Comparativo do saldo de cada cenário por mês'});
    for(let i=0;i<=4;i++){
      const val=low+(high-low)*(1-i/4);const h=y(val);
      svg.append(svgEl('line',{x1:L,y1:h,x2:W-R,y2:h,stroke:'#eaf0f4','stroke-width':1}));
      svg.append(svgEl('text',{x:L-12,y:h+4,'text-anchor':'end',class:'axis-label'},new Intl.NumberFormat('pt-BR',{notation:'compact',maximumFractionDigits:1}).format(val)));
    }
    if(low<0&&high>0)svg.append(svgEl('line',{x1:L,y1:y(0),x2:W-R,y2:y(0),stroke:'#bfc9d4','stroke-dasharray':'4 4'}));
    for(const [field,color] of [['a','#17b890'],['b','#4568cf']]){
      let segment=[];
      const flush=()=>{if(segment.length>1)svg.append(svgEl('polyline',{points:segment.join(' '),fill:'none',stroke:color,'stroke-width':3,'stroke-linejoin':'round','stroke-linecap':'round'}));segment=[];};
      for(let i=0;i<entries.length;i++){
        const v=entries[i][1][field];if(v===null){flush();continue;}
        segment.push(`${x(i)},${y(v)}`);
        const dot=svgEl('circle',{cx:x(i),cy:y(v),r:3.5,fill:'#fff',stroke:color,'stroke-width':2});
        dot.append(svgEl('title',{},`${entries[i][0]}: ${money(v)}`));svg.append(dot);
      }
      flush();
    }
    const stride=Math.max(1,Math.ceil(entries.length/7));
    for(let i=0;i<entries.length;i++)if(i%stride===0||i===entries.length-1){
      const [yr,mo]=entries[i][0].split('-').map(Number);
      const label=new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(Date.UTC(yr,mo-1,1))).replace('.','');
      svg.append(svgEl('text',{x:x(i),y:H-12,'text-anchor':'middle',class:'axis-label'},label));
    }
    holder.append(svg);
    return entries;
  }
  function renderCompare(){
    const aSelect=dom('compareA'),bSelect=dom('compareB');
    const options=[{id:'current',name:'Simulação atual'},...savedScenarios.map(s=>({id:s.id,name:s.name}))];
    if(!options.some(x=>x.id===compareA))compareA='current';
    if(!options.some(x=>x.id===compareB))compareB=savedScenarios[0]?.id||'current';
    for(const [el,value] of [[aSelect,compareA],[bSelect,compareB]]){
      el.replaceChildren();for(const option of options){const child=document.createElement('option');child.value=option.id;child.textContent=option.name;el.append(child);}el.value=value;
    }
    const enough=savedScenarios.length>0;
    dom('compareContent').hidden=!enough;
    const hint=dom('compareHint');
    if(!enough){hint.textContent='Salve uma versão no painel à esquerda para começar. Depois altere os valores da simulação atual e compare as duas.';return;}
    const a=simulate(scenarioData(compareA)),b=simulate(scenarioData(compareB));
    hint.textContent=compareA===compareB?'Os dois lados usam o mesmo cenário. Escolha versões diferentes para ver as diferenças.':'Variação B − A: valores positivos de saldo representam uma melhora no cenário B. A comparação dos meses respeita as datas de cada cenário.';
    setText('compareLabelA',scenarioName(compareA));setText('compareLabelB',scenarioName(compareB));
    const stats=dom('compareStats');stats.replaceChildren();
    compareMetric(stats,'Saldo final · B − A',a.final,b.final);
    compareMetric(stats,'Juros · B − A',a.totalInterest,b.totalInterest,true);
    compareMetric(stats,'IOF · B − A',a.totalIof,b.totalIof,true);
    compareMetric(stats,'Gastos · B − A',a.totalExpenses,b.totalExpenses,true);
    const entries=renderCompareChart(a,b),rows=dom('compareMonths');rows.replaceChildren();
    let overlap=0;
    for(const [month,v] of entries){
      const tr=document.createElement('tr'),label=document.createElement('td');label.textContent=formatMonth(month);label.className='month';tr.append(label);
      for(const x of [v.a,v.b]){const cell=document.createElement('td');cell.textContent=x===null?'—':money(x);if(x!==null)cell.className=x<0?'value-negative':'value-positive';tr.append(cell);}
      const diff=document.createElement('td');
      if(v.a===null||v.b===null)diff.textContent='—';
      else{overlap++;const delta=round(v.b-v.a);diff.textContent=`${delta>0?'+':''}${money(delta)}`;diff.className=delta>0?'value-positive':delta<0?'value-negative':'';}
      tr.append(diff);rows.append(tr);
    }
    if(overlap===0)hint.textContent+=' Atenção: os dois cenários não possuem meses coincidentes; compare os saldos finais com cautela.';
  }
  function update(){
    state=normalize(state);persist();renderEvents();
    const sim=simulate(state);months=sim.rows;renderSummary(sim);renderChart(sim);renderTable(sim);renderBreakdown(sim);renderCompare();
    dom('rate-note').textContent=parseNumber(state.rate)>8?'A taxa informada excede o teto regulatório do cheque especial para pessoa física: 8% ao mês.':'A taxa máxima regulatória do cheque especial para pessoa física é 8% ao mês.';
  }
  let toastTimer;
  function toast(message){const el=dom('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200);}
  function download(filename,content,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  for(const key of ['balance','income','expenses','rate','startMonth']){
    dom(key).addEventListener(key==='startMonth'?'change':'input',ev=>{if(key==='startMonth'&&!validMonth(ev.target.value))return;state[key]=ev.target.value;update();});
  }
  dom('event-form').addEventListener('submit',ev=>{
    ev.preventDefault();const date=dom('eventDate').value,amount=dom('eventAmount').value,type=dom('eventType').value;
    if(!validDate(date)||!TYPE_NAMES[type]||!amount.trim()||parseNumber(amount)<0){toast('Confira a data e o valor da movimentação.');return;}
    const item={id:Math.max(0,...state.changes.map(e=>e.id))+1,name:dom('eventName').value.trim().slice(0,90)||TYPE_NAMES[type],type,date,amount};
    state.changes.push(item);dom('eventName').value='';update();toast('Mudança incluída na projeção.');
  });
  dom('monthSelect').addEventListener('change',ev=>{selectedMonth=Number(ev.target.value);const sim=simulate(state);renderTable(sim);renderBreakdown(sim);});
  dom('save-scenario-form').addEventListener('submit',ev=>{
    ev.preventDefault();
    const name=dom('scenarioName').value.trim().slice(0,70);
    if(!name){toast('Informe um nome para salvar a versão.');return;}
    if(savedScenarios.length>=MAX_SCENARIOS){toast('Limite de 50 cenários: exclua uma versão antes de salvar outra.');return;}
    const id=`scenario-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    const entry={id,name,createdAt:new Date().toISOString(),data:cloneState(state)};
    savedScenarios.unshift(entry);
    if(!persistSaved()){savedScenarios.shift();toast('Não foi possível salvar. Verifique o espaço disponível e as permissões do navegador.');return;}
    dom('scenarioName').value='';compareA='current';compareB=id;
    renderSaved();renderCompare();toast(`Cenário “${name}” salvo neste navegador.`);
  });
  dom('compareA').addEventListener('change',ev=>{compareA=ev.target.value;renderCompare();});
  dom('compareB').addEventListener('change',ev=>{compareB=ev.target.value;renderCompare();});
  dom('reset').addEventListener('click',()=>{if(!window.confirm('Restaurar os valores de exemplo? Os dados atuais serão substituídos.'))return;state=cloneSample();selectedMonth=0;syncForm();update();toast('Exemplo restaurado.');});
  dom('exportCsv').addEventListener('click',()=>{
    const heads=['Mês','Saldo inicial','Salário','Recebimentos únicos','Gasto mensal','Gastos únicos','Juros','IOF diário','IOF adicional','Saldo final'];
    const csvCell=v=>`"${String(v).replace(/"/g,'""')}"`;
    const numeric=n=>Number(n).toFixed(2).replace('.',',');
    const data=[heads,...months.map(r=>[r.label,r.opening,r.income,r.extraIncome,r.expenses,r.extraExpenses,r.interest,r.dailyIof,r.additionalIof,r.closing].map((v,i)=>i===0?v:numeric(v)))];
    download('horizonte-projecao-12-meses.csv','\ufeff'+data.map(row=>row.map(csvCell).join(';')).join('\r\n'),'text/csv;charset=utf-8;');toast('Relatório CSV exportado.');
  });
  dom('exportJson').addEventListener('click',()=>{
    const backup={schema:'horizonte-backup',version:2,exportedAt:new Date().toISOString(),current:cloneState(state),saved:savedScenarios};
    download('horizonte-backup-cenarios.json',JSON.stringify(backup,null,2),'application/json');
    toast('Backup completo baixado: cenário atual e versões salvas.');
  });
  dom('importTrigger').addEventListener('click',()=>dom('importJson').click());
  dom('importJson').addEventListener('change',async ev=>{
    const file=ev.target.files?.[0];if(!file)return;
    if(file.size>3*1024*1024){toast('Arquivo muito grande. Limite de 3 MB.');ev.target.value='';return;}
    try{
      const raw=JSON.parse(await file.text());
      if(raw&&raw.schema==='horizonte-backup'&&raw.version===2&&raw.current&&Array.isArray(raw.current.changes)&&Array.isArray(raw.saved)){
        if(!window.confirm('Importar o backup? A simulação atual e todos os cenários já salvos neste navegador serão substituídos.'))return;
        const incoming=raw.saved.slice(0,MAX_SCENARIOS).filter(x=>x&&typeof x==='object'&&x.data&&Array.isArray(x.data.changes)).map((x,i)=>({
          id:String(x.id||`backup-${i}`).slice(0,90),name:String(x.name||`Cenário ${i+1}`).slice(0,70),createdAt:String(x.createdAt||'').slice(0,40),data:normalize(x.data)
        }));
        const old=savedScenarios;savedScenarios=incoming;
        if(!persistSaved()){savedScenarios=old;throw Error('storage');}
        state=normalize(raw.current);compareA='current';compareB=savedScenarios[0]?.id||'current';
        selectedMonth=0;syncForm();renderSaved();update();toast(`Backup importado com ${savedScenarios.length} cenários.`);
      }else if(raw&&typeof raw==='object'&&Array.isArray(raw.changes)){
        if(!window.confirm('Importar esta simulação? Os valores atuais serão substituídos, mas seus cenários salvos continuarão disponíveis.'))return;
        state=normalize(raw);selectedMonth=0;syncForm();update();toast('Simulação importada. As versões salvas foram preservadas.');
      }else throw Error('invalid');
    }catch(e){toast('Não foi possível importar. Verifique o arquivo ou o armazenamento.');}
    finally{ev.target.value='';}
  });
  syncForm();renderSaved();update();
})();