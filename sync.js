/* Shared by the browser and isolated regression tests. No credentials or I/O. */
(function (root) {
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const object = x => x && typeof x === 'object' && !Array.isArray(x);
  const get = (value, path) => path.reduce((v, k) => v?.[k], value);
  const memberFields = ['foodLog','stepsByWeek','dailyWeightByWeek','wellbeingByWeek','sleepByWeek','waterByWeek','trainingAttendanceByWeek'];
  const hasValue = value => {
    if (Array.isArray(value)) return value.some(hasValue);
    if (object(value)) return Object.entries(value).some(([k,v]) => !['day','date'].includes(k) && hasValue(v));
    return value !== '' && value !== undefined && value !== null;
  };
  function snapshot(state, role) {
    const result = clone(state);
    delete result.ui; delete result.trainerAccount;
    result.clients = (result.clients || []).map(c => {
      for (const key of ['password','registered','steps','dailyWeight','wellbeing','sleep','water','trainingAttendance']) delete c[key];
      if (role === 'client') {
        for (const key of Object.keys(c)) if (!['id','trainingPlan','nutritionPlan',...memberFields].includes(key)) delete c[key];
      }
      for (const key of memberFields.filter(k=>k.endsWith('ByWeek'))) {
        if(c[key]) for(const week of Object.keys(c[key])) if(!hasValue(c[key][week])) delete c[key][week];
      }
      for(const key of ['trainingPlan','nutritionPlan']) for(const entry of c[key] || []) {
        if(entry.logsByWeek) for(const week of Object.keys(entry.logsByWeek)) if(!hasValue(entry.logsByWeek[week])) delete entry.logsByWeek[week];
      }
      return c;
    });
    if (role === 'client') for (const key of Object.keys(result)) if (key !== 'clients') delete result[key];
    return result;
  }
  function diff(base, next, raw = base, role = 'trainer') {
    const ops = [];
    function walk(a, b, server, scope, path = []) {
      if (equal(a,b)) return;
      if (object(a) && object(b)) {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[key],b[key],server?.[key],scope,[...path,key]);
      } else {
        ops.push({...scope,path,before:clone(server ?? null),before_exists:server !== undefined,after:clone(b ?? null),after_exists:b !== undefined});
      }
    }
    const a = snapshot(base,role), b = snapshot(next,role);
    for (const id of new Set([...a.clients,...b.clients].map(c=>c.id))) {
      const old = a.clients.find(c=>c.id===id), fresh = b.clients.find(c=>c.id===id), server = raw.clients?.find(c=>c.id===id);
      if (!old || !fresh) { walk(old,fresh,server,{client_id:id}); continue; }
      for (const key of new Set([...Object.keys(old),...Object.keys(fresh)])) {
        if (key === 'id') continue;
        if (role === 'client' && ['trainingPlan','nutritionPlan'].includes(key)) {
          for (const item of fresh[key] || []) {
            const prev = old[key]?.find(e=>e.id===item.id), remote = server?.[key]?.find(e=>e.id===item.id);
            if (prev) walk(prev.logsByWeek || {}, item.logsByWeek || {}, remote?.logsByWeek || {},{client_id:id,collection:key,entity_id:item.id},['logsByWeek']);
          }
        } else walk(old[key],fresh[key],server?.[key],{client_id:id},[key]);
      }
    }
    for (const key of new Set([...Object.keys(a),...Object.keys(b)])) if (key !== 'clients') walk(a[key],b[key],raw[key],{client_id:null},[key]);
    return ops;
  }
  function apply(raw, ops) {
    const result = clone(raw);
    for (const op of ops) {
      let target = result;
      if (op.client_id) {
        const index = result.clients.findIndex(c=>c.id===op.client_id);
        if (!op.path.length) {
          if (index >= 0) result.clients.splice(index,1);
          if (op.after_exists) result.clients.push(clone(op.after));
          continue;
        }
        target = result.clients[index];
        if (op.collection) target = target[op.collection].find(e=>e.id===op.entity_id);
      }
      for (const key of op.path.slice(0,-1)) target = target[key] ||= {};
      if (op.after_exists) target[op.path.at(-1)] = clone(op.after);
      else delete target[op.path.at(-1)];
    }
    return result;
  }
  function occurrences(appointment, count = 12) {
    if (!['weekly','biweekly','monthly'].includes(appointment.repeat)) return [appointment];
    const start = new Date(`${appointment.date}T12:00:00`);
    if (!Number.isFinite(+start)) throw new Error('Ongeldige afspraakdatum');
    return Array.from({length:Math.min(12,Math.max(1,count))},(_,i)=> {
      const date = new Date(start);
      if (appointment.repeat === 'monthly') {
        date.setDate(1); date.setMonth(date.getMonth()+i);
        date.setDate(Math.min(start.getDate(),new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));
      } else date.setDate(date.getDate()+i*(appointment.repeat==='weekly'?7:14));
      const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      return {...appointment,id:i?`${appointment.id}-r${i}`:appointment.id,date:key,seriesId:appointment.id,repeat:'',repeatRule:appointment.repeat,...(i?{amount:'',rateId:'',rateName:'',adminItemId:'',adminItemSuppressed:true}:{})};
    });
  }
  root.FMZSync = {clone,equal,get,snapshot,diff,apply,occurrences};
  if (typeof module !== 'undefined') module.exports = root.FMZSync;
})(typeof window !== 'undefined' ? window : globalThis);
