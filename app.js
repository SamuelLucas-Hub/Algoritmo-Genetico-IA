/* app.js — interface do simulador. A lógica do algoritmo genético está em ga.js. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const PARAM_KEYS = ['budget', 'popSize', 'generations', 'crossRate', 'mutRate', 'tournament', 'elite', 'seed'];
  const MIN_ITEMS = 4, MAX_ITEMS = 15;
  const ORD = ['primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto', 'sétimo', 'oitavo', 'nono', 'décimo',
    '11º', '12º', '13º', '14º', '15º'];

  let rows = [
    { name: 'Melhoria da iluminação', cost: '4000.00', benefit: '7' },
    { name: 'Instalação de bicicletários', cost: '3000.00', benefit: '5' },
    { name: 'Aquisição de bancos', cost: '2000.00', benefit: '3' },
    { name: 'Reforma de espaço de convivência', cost: '5000.00', benefit: '8' }
  ];
  let engine = null, running = false, timer = null, dirty = false, valid = true, lastAction = 'ready';
  let renderedHist = 0, loggedGen = -1;

  // ---------- utilidades ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtMoney = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtPts = v => (v / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const bitsStr = g => g.join('');
  const geneLetter = i => String.fromCharCode(65 + i);
  const ordList = idx => {
    const w = idx.map(i => ORD[i]);
    if (w.length === 1) return 'gene ' + w[0];
    return 'genes ' + w.slice(0, -1).join(', ') + ' e ' + w[w.length - 1];
  };

  // "7000", "7000.5", "7000,50" -> centavos; qualquer outra coisa -> null
  function parseDecimal(str) {
    const m = /^(\d{1,12})(?:[.,](\d{1,2}))?$/.exec(String(str).trim());
    return m ? Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0')) : null;
  }
  function parsePercent(str) {
    const m = /^(\d{1,3})(?:[.,](\d{1,4}))?$/.exec(String(str).trim());
    if (!m) return null;
    const v = parseFloat(m[1] + '.' + (m[2] || '0'));
    return v >= 0 && v <= 100 ? v : null;
  }
  const parseUInt = str => (/^\d{1,6}$/.test(String(str).trim()) ? Number(str.trim()) : null);
  const parseSeed = str => (/^-?\d{1,15}$/.test(String(str).trim()) ? Number(str.trim()) : null);

  // ---------- tabela de projetos ----------
  function renderRows() {
    const body = $('projBody');
    body.innerHTML = '';
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML =
        `<td><b>${geneLetter(i)}</b> <span class="hint">(${i + 1}º)</span></td>` +
        `<td><input id="name${i}" type="text" aria-label="Nome do projeto ${i + 1}" value="${esc(r.name)}" autocomplete="off"><span class="err" id="e-name${i}"></span></td>` +
        `<td><input id="cost${i}" type="text" inputmode="decimal" aria-label="Custo do projeto ${i + 1}" value="${esc(r.cost)}" autocomplete="off"><span class="err" id="e-cost${i}"></span></td>` +
        `<td><input id="benefit${i}" type="text" inputmode="decimal" aria-label="Benefício do projeto ${i + 1}" value="${esc(r.benefit)}" autocomplete="off"><span class="err" id="e-benefit${i}"></span></td>` +
        `<td><button type="button" class="small" data-remove="${i}" ${rows.length <= MIN_ITEMS ? 'disabled' : ''} aria-label="Remover projeto ${i + 1}">Remover</button></td>`;
      body.appendChild(tr);
      ['name', 'cost', 'benefit'].forEach(f => {
        $(f + i).addEventListener('input', e => { rows[i][f] = e.target.value; onEdit(); });
      });
    });
    body.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
      if (rows.length <= MIN_ITEMS) return;
      rows.splice(Number(b.dataset.remove), 1);
      renderRows(); onEdit();
    }));
    $('btnAdd').disabled = rows.length >= MAX_ITEMS;
    $('countHint').textContent = rows.length + ' projetos (mínimo ' + MIN_ITEMS + ', máximo ' + MAX_ITEMS + ')';
  }

  // ---------- validação ----------
  function validate() {
    const errors = {};
    const projects = [];
    rows.forEach((r, i) => {
      const name = r.name.trim();
      if (!name) errors['name' + i] = 'Informe um nome.';
      const c = parseDecimal(r.cost);
      if (c === null) errors['cost' + i] = 'Informe um valor em reais com até 2 casas (ex.: 4000 ou 4000,50), sem separador de milhar.';
      else if (c <= 0) errors['cost' + i] = 'O custo deve ser positivo.';
      const b = parseDecimal(r.benefit);
      if (b === null) errors['benefit' + i] = 'Informe um número não negativo com até 2 casas decimais.';
      projects.push({ name, cost: c, benefit: b });
    });
    if (rows.length < MIN_ITEMS || rows.length > MAX_ITEMS) errors.count = 'Mantenha entre ' + MIN_ITEMS + ' e ' + MAX_ITEMS + ' projetos.';

    const budget = parseDecimal($('budget').value);
    if (budget === null) errors.budget = 'Informe um valor em reais, não negativo, com até 2 casas (ex.: 7000 ou 7000,50).';

    const pop = parseUInt($('popSize').value);
    if (pop === null || pop < 2) errors.popSize = 'Informe um inteiro maior ou igual a 2.';
    const gens = parseUInt($('generations').value);
    if (gens === null || gens < 1) errors.generations = 'Informe um inteiro maior ou igual a 1.';
    const cr = parsePercent($('crossRate').value);
    if (cr === null) errors.crossRate = 'Informe um percentual entre 0 e 100.';
    const mr = parsePercent($('mutRate').value);
    if (mr === null) errors.mutRate = 'Informe um percentual entre 0 e 100.';

    const popOk = pop !== null && pop >= 2;
    const tour = parseUInt($('tournament').value);
    if (tour === null || tour < 2) errors.tournament = 'Informe um inteiro maior ou igual a 2.';
    else if (popOk && tour > pop) errors.tournament = 'O torneio não pode exceder o tamanho da população (' + pop + ').';
    const elite = parseUInt($('elite').value);
    if (elite === null) errors.elite = 'Informe um inteiro maior ou igual a 0.';
    else if (popOk && elite > pop - 1) errors.elite = 'No máximo população − 1 (' + (pop - 1) + ').';
    const seed = parseSeed($('seed').value);
    if (seed === null) errors.seed = 'Informe um número inteiro.';

    const cfg = Object.keys(errors).length ? null : {
      projects, budget, popSize: pop, generations: gens, crossRate: cr / 100, mutRate: mr / 100,
      tournament: tour, elite, seed
    };
    return { errors, cfg };
  }

  function applyErrors(errors) {
    const keys = PARAM_KEYS.concat(rows.flatMap((_, i) => ['name' + i, 'cost' + i, 'benefit' + i]));
    keys.forEach(k => {
      const inp = $(k), e = $('e-' + k);
      if (inp) inp.classList.toggle('invalid', !!errors[k]);
      if (e) e.textContent = errors[k] || '';
    });
    $('e-count').textContent = errors.count || '';
  }

  // ---------- estado dos controles ----------
  function updateButtons() {
    const canGo = !dirty && valid && engine && !engine.finished;
    $('btnRun').disabled = !(canGo && !running);
    $('btnPause').disabled = !running;
    $('btnStep').disabled = !(canGo && !running);
    $('btnReset').disabled = !valid;
  }
  function updateStatus() {
    const el = $('status');
    let txt, warn = false;
    if (!valid) { txt = 'Há campos inválidos. Corrija-os para continuar (todos os controles ficam bloqueados).'; warn = true; }
    else if (dirty) { txt = 'Dados ou parâmetros alterados: clique em Reiniciar para aplicá-los.'; warn = true; }
    else if (engine.finished) txt = 'Concluído: limite de ' + engine.config.generations + ' gerações atingido. Clique em Reiniciar para uma nova execução.';
    else if (running) txt = 'Executando… (geração ' + engine.generation + ' de ' + engine.config.generations + ')';
    else if (lastAction === 'pause') txt = 'Pausado na geração ' + engine.generation + ' de ' + engine.config.generations + '. Executar retoma de onde parou.';
    else if (lastAction === 'step') txt = 'Avançou uma geração (' + engine.generation + ' de ' + engine.config.generations + '). Execução pausada.';
    else txt = 'Pronto: população inicial (geração 0) criada com a semente ' + engine.config.seed + '.';
    el.textContent = txt;
    el.classList.toggle('warn', warn);
  }

  function onEdit() {
    stopRun();
    const v = validate();
    valid = !!v.cfg;
    dirty = true;
    applyErrors(v.errors);
    updateButtons();
    updateStatus();
  }

  // ---------- execução ----------
  function stopRun() { running = false; clearTimeout(timer); timer = null; }
  function advance() { engine.step(); renderAll(); }
  function loop() {
    timer = setTimeout(() => {
      if (!running) return;
      advance();
      if (engine.finished) running = false; else loop();
      updateButtons(); updateStatus();
    }, Number($('speed').value));
  }
  function run() {
    if (dirty || !valid || engine.finished || running) return;
    running = true; lastAction = 'run';
    updateButtons(); updateStatus(); loop();
  }
  function pause() { if (!running) return; stopRun(); lastAction = 'pause'; updateButtons(); updateStatus(); }
  function stepOnce() {
    if (dirty || !valid || engine.finished || running) return;
    lastAction = 'step';
    advance(); updateButtons(); updateStatus();
  }
  function restart() {
    const v = validate();
    applyErrors(v.errors);
    valid = !!v.cfg;
    if (!v.cfg) { updateButtons(); updateStatus(); return; }
    stopRun();
    engine = GA.createEngine(v.cfg);
    dirty = false; lastAction = 'ready';
    $('histBody').innerHTML = ''; $('log').innerHTML = '';
    renderedHist = 0; loggedGen = -1;
    renderAll(); updateButtons(); updateStatus();
  }

  // ---------- renderização ----------
  function bitsSpan(genes, o) {
    o = o || {};
    let h = '<span class="bits">';
    genes.forEach((g, i) => {
      if (o.cut === i) h += '<i class="cut" title="ponto de corte"></i>';
      h += '<span class="bit ' + (o.cls ? o.cls(i) : '') + '">' + g + '</span>';
    });
    return h + '</span>';
  }
  function repairChain(raw, steps) {
    let h = '', prev = raw;
    steps.forEach(s => { h += bitsSpan(prev, { cls: i => (i === s.removed ? 'rem' : '') }) + ' → '; prev = s.genes; });
    return h + bitsSpan(prev);
  }
  const names = (steps, pj) => steps.map(s => pj[s.removed].name).join(', ');
  const stage = (name, html, d) => '<div class="stage" style="animation-delay:' + d + 's"><span class="name">' + name + '</span>' + html + '</div>';
  const col = lines => '<div class="col">' + lines.join('') + '</div>';
  const note = t => '<span class="note">' + t + '</span>';

  function renderMetrics() {
    const h = engine.history[engine.history.length - 1];
    $('mGen').textContent = engine.generation + ' / ' + engine.config.generations;
    $('mBest').textContent = fmtPts(h.bestFitness);
    $('mAvg').textContent = fmtPts(h.avgFitness);
    $('mAcc').textContent = fmtPts(h.bestSoFar);
  }

  function renderResult() {
    const b = engine.best, pj = engine.config.projects;
    const chosen = pj.filter((_, i) => b.genes[i] === 1).map(p => esc(p.name));
    $('resTitle').textContent = engine.finished ? 'Resultado final (melhor solução de toda a execução)' : 'Melhor solução até agora';
    $('result').innerHTML =
      '<div>Cromossomo: ' + bitsSpan(b.genes, { cls: i => (b.genes[i] ? 'pa' : '') }) + '</div>' +
      '<p>Projetos escolhidos: ' + (chosen.length ? chosen.join('; ') : '<i>nenhum (seleção vazia, aptidão 0)</i>') + '</p>' +
      '<div class="result-grid">' +
      '<div class="metric"><span class="lbl">Custo total</span><span class="val">' + fmtMoney(b.cost) + '</span></div>' +
      '<div class="metric"><span class="lbl">Benefício total</span><span class="val">' + fmtPts(b.benefit) + '</span></div>' +
      '<div class="metric"><span class="lbl">Saldo do orçamento</span><span class="val">' + fmtMoney(b.balance) + '</span></div>' +
      '<div class="metric"><span class="lbl">Encontrada na geração</span><span class="val">' + b.generation + '</span></div>' +
      '</div>' +
      '<p class="hint">Orçamento: ' + fmtMoney(engine.config.budget) + ' — solução ' + (b.balance >= 0 ? '<span class="ok">viável</span>' : 'inviável') + '.</p>';
  }

  function renderHistory() {
    const body = $('histBody');
    for (; renderedHist < engine.history.length; renderedHist++) {
      const h = engine.history[renderedHist];
      const tr = document.createElement('tr');
      tr.innerHTML = '<td>' + h.generation + '</td><td>' + fmtPts(h.bestFitness) + '</td><td>' + fmtPts(h.avgFitness) + '</td><td>' + fmtPts(h.bestSoFar) + '</td>';
      body.appendChild(tr);
    }
    const wrap = body.parentElement.parentElement;
    wrap.scrollTop = wrap.scrollHeight;
  }

  function drawChart() {
    const cv = $('chart'), hist = engine.history;
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 600, h = 240;
    cv.style.height = h + 'px'; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const css = getComputedStyle(document.documentElement);
    const col = n => css.getPropertyValue(n).trim() || '#888';
    const L = 52, R = 14, T = 12, B = 30, pw = w - L - R, ph = h - T - B;
    let maxY = 1;
    hist.forEach(p => { maxY = Math.max(maxY, p.bestFitness, p.avgFitness, p.bestSoFar); });
    const xMax = Math.max(engine.config.generations, 1);
    const X = g => L + (g / xMax) * pw, Y = v => T + ph - (v / maxY) * ph;
    ctx.font = '12px system-ui, sans-serif'; ctx.fillStyle = col('--muted'); ctx.strokeStyle = col('--line'); ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const v = (maxY * k) / 4, y = Y(v);
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(w - R, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(fmtPts(v), L - 6, y + 4);
    }
    ctx.textAlign = 'center';
    for (let k = 0; k <= 5; k++) { const g = Math.round((xMax * k) / 5); ctx.fillText(g, X(g), h - 10); }
    const line = (key, color) => {
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; ctx.beginPath();
      hist.forEach((p, i) => { const x = X(p.generation), y = Y(p[key]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();
      if (hist.length === 1) { ctx.beginPath(); ctx.arc(X(0), Y(hist[0][key]), 3, 0, Math.PI * 2); ctx.fill(); }
    };
    line('avgFitness', col('--s2')); line('bestFitness', col('--s1')); line('bestSoFar', col('--s3'));
  }

  // ----- log textual -----
  function pairText(ev, pj, n) {
    const A = ev.parentA, B = ev.parentB;
    let t = 'Par ' + n + ' — Pais: ' + bitsStr(A.genes) + ' (índice ' + A.index + ', torneio entre ' + A.candidates.join(', ') + ') e ' +
      bitsStr(B.genes) + ' (índice ' + B.index + ', torneio entre ' + B.candidates.join(', ') + '); ';
    t += ev.crossed ? 'corte após o ' + ORD[ev.cut - 1] + ' gene; ' : 'sem cruzamento (filhos copiam os pais); ';
    t += 'filhos: ' + bitsStr(ev.children[0].afterCross) + ' e ' + bitsStr(ev.children[1].afterCross) + '; ';
    const mut = [];
    ev.children.forEach((c, k) => {
      if (c.flips.length) mut.push('mutação no ' + ordList(c.flips) + ' do filho ' + (k + 1) + ': ' + bitsStr(c.afterMutation));
    });
    t += mut.length ? mut.join('; ') : 'sem mutação';
    const rep = [];
    ev.children.forEach((c, k) => {
      if (c.repairSteps.length) rep.push('reparação do filho ' + (k + 1) + ': ' + [bitsStr(c.afterMutation)].concat(c.repairSteps.map(s => bitsStr(s.genes))).join(' → ') +
        ' (removidos: ' + names(c.repairSteps, pj) + ')');
    });
    t += '; ' + (rep.length ? rep.join('; ') : 'nenhuma reparação necessária');
    t += '; resultado: ' + bitsStr(ev.children[0].individual.genes) + ' (aptidão ' + fmtPts(ev.children[0].individual.fitness) + ')';
    if (ev.children[1].kept) t += ' e ' + bitsStr(ev.children[1].individual.genes) + ' (aptidão ' + fmtPts(ev.children[1].individual.fitness) + ')';
    else t += '; filho 2 descartado (resta apenas uma vaga)';
    return t;
  }
  function renderLog() {
    const log = $('log'), pj = engine.config.projects;
    while (loggedGen < engine.generation) {
      loggedGen++;
      const g = loggedGen;
      const blk = document.createElement('div');
      const lines = [];
      if (g === 0) {
        lines.push('<div class="gen">Geração 0 — população inicial aleatória</div>');
        const ev = engine.history.length && g === engine.generation ? engine.events : [];
        ev.slice(0, 30).forEach(e => {
          let t = 'Indivíduo ' + e.index + ': sorteado ' + bitsStr(e.raw);
          if (e.steps.length) t += '; reparação: ' + [bitsStr(e.raw)].concat(e.steps.map(s => bitsStr(s.genes))).join(' → ') + ' (removidos: ' + names(e.steps, pj) + ')';
          t += '; aptidão ' + fmtPts(e.individual.fitness);
          lines.push('<div class="line">' + esc(t) + '</div>');
        });
        if (ev.length > 30) lines.push('<div class="line">… ' + (ev.length - 30) + ' indivíduos omitidos do log.</div>');
      } else if (g === engine.generation) {
        lines.push('<div class="gen">Geração ' + g + '</div>');
        let n = 0, shown = 0;
        engine.events.forEach(e => {
          if (e.type === 'elite') {
            lines.push('<div class="line">' + esc('Elitismo: preservado ' + bitsStr(e.individual.genes) + ' (aptidão ' + fmtPts(e.individual.fitness) + '), índice ' + e.fromIndex + ' da população anterior') + '</div>');
          } else {
            n++;
            if (shown < 100) { lines.push('<div class="line">' + esc(pairText(e, pj, n)) + '</div>'); shown++; }
          }
        });
        if (n > shown) lines.push('<div class="line">… ' + (n - shown) + ' pares omitidos do log.</div>');
      } else continue; // geração intermediária já passou (não deve ocorrer)
      blk.innerHTML = lines.join('');
      log.appendChild(blk);
      while (log.children.length > 120) log.removeChild(log.firstChild);
    }
    log.scrollTop = log.scrollHeight;
  }

  // ----- visualização animada da última geração -----
  function pairCard(ev, n, pj) {
    const A = ev.parentA, B = ev.parentB, cut = ev.cut;
    let d = 0;
    const next = () => (d += 0.55);
    let h = '<div class="pair"><h3>Par ' + n + '</h3>';
    h += stage('1. Seleção', col([
      '<div>Pai A ' + bitsSpan(A.genes, { cls: () => 'pa' }) + ' ' + note('índice ' + A.index + ' — torneio entre ' + A.candidates.join(', ')) + '</div>',
      '<div>Pai B ' + bitsSpan(B.genes, { cls: () => 'pb' }) + ' ' + note('índice ' + B.index + ' — torneio entre ' + B.candidates.join(', ')) + '</div>'
    ]), next());
    const c1 = ev.children[0], c2 = ev.children[1];
    if (ev.crossed) {
      h += stage('2. Cruzamento', col([
        '<div>' + bitsSpan(A.genes, { cut, cls: () => 'pa' }) + ' + ' + bitsSpan(B.genes, { cut, cls: () => 'pb' }) + ' ' + note('corte após o ' + ORD[cut - 1] + ' gene') + '</div>',
        '<div>Filho 1 ' + bitsSpan(c1.afterCross, { cut, cls: i => (i < cut ? 'pa' : 'pb') }) + '</div>',
        '<div>Filho 2 ' + bitsSpan(c2.afterCross, { cut, cls: i => (i < cut ? 'pb' : 'pa') }) + '</div>'
      ]), next());
    } else {
      h += stage('2. Cruzamento', col([
        '<div>' + note('não ocorreu (sorteio acima da taxa): os filhos copiam os pais') + '</div>',
        '<div>Filho 1 ' + bitsSpan(c1.afterCross, { cls: () => 'pa' }) + '</div>',
        '<div>Filho 2 ' + bitsSpan(c2.afterCross, { cls: () => 'pb' }) + '</div>'
      ]), next());
    }
    h += stage('3. Mutação', col(ev.children.map((c, k) => {
      const fl = new Set(c.flips);
      return '<div>Filho ' + (k + 1) + ' ' + bitsSpan(c.afterMutation, { cls: i => (fl.has(i) ? 'mut' : '') }) + ' ' +
        note(c.flips.length ? c.flips.length + ' bit(s) invertido(s): ' + ordList(c.flips) : 'nenhum bit alterado') + '</div>';
    })), next());
    h += stage('4. Reparação', col(ev.children.map((c, k) =>
      '<div>Filho ' + (k + 1) + ' ' + repairChain(c.afterMutation, c.repairSteps) + ' ' +
      note(c.repairSteps.length ? 'removidos: ' + esc(names(c.repairSteps, pj)) : 'já viável, sem reparação') + '</div>')), next());
    h += stage('5. Resultado', col(ev.children.map((c, k) =>
      '<div>Filho ' + (k + 1) + ' ' + bitsSpan(c.individual.genes) + ' ' +
      note(c.kept ? 'custo ' + fmtMoney(c.individual.cost) + '; aptidão ' + fmtPts(c.individual.fitness)
        : 'descartado: resta só uma vaga, mantém-se apenas o 1º filho do último par') + '</div>')), next());
    return h + '</div>';
  }
  function renderViz() {
    const pj = engine.config.projects, evs = engine.events;
    let h = '';
    if (engine.generation === 0) {
      h += '<p class="hint">Geração 0: população inicial sorteada (cada gene com 50% de chance) e reparada.</p>';
      evs.slice(0, 30).forEach(e => {
        let d = 0;
        h += '<div class="pair"><h3>Indivíduo ' + e.index + '</h3>' +
          stage('Sorteio', bitsSpan(e.raw), d += 0.2) +
          stage('Reparação', e.steps.length ? repairChain(e.raw, e.steps) + ' ' + note('removidos: ' + esc(names(e.steps, pj))) : note('já viável'), d += 0.4) +
          stage('Final', bitsSpan(e.individual.genes) + ' ' + note('custo ' + fmtMoney(e.individual.cost) + '; aptidão ' + fmtPts(e.individual.fitness)), d + 0.4) + '</div>';
      });
      if (evs.length > 30) h += '<p class="hint">Mostrando 30 de ' + evs.length + ' indivíduos.</p>';
    } else {
      const elites = evs.filter(e => e.type === 'elite'), pairs = evs.filter(e => e.type === 'pair');
      h += '<p class="hint">Geração ' + engine.generation + ': ' + elites.length + ' preservado(s) por elitismo e ' + pairs.length + ' par(es) de pais.</p>';
      if (elites.length) {
        h += '<div class="pair elite-box"><h3>Elitismo (cópia sem modificação)</h3>' + elites.map((e, i) =>
          stage('Elite ' + e.rank, bitsSpan(e.individual.genes, { cls: () => 'pa' }) + ' ' + note('índice ' + e.fromIndex + ' da população anterior; aptidão ' + fmtPts(e.individual.fitness)), i * 0.3)).join('') + '</div>';
      }
      pairs.slice(0, 30).forEach((e, i) => { h += pairCard(e, i + 1, pj); });
      if (pairs.length > 30) h += '<p class="hint">Mostrando 30 de ' + pairs.length + ' pares (todos constam no log).</p>';
    }
    $('viz').innerHTML = h;
  }

  function renderAll() {
    renderMetrics(); renderResult(); renderHistory(); renderLog(); drawChart(); renderViz();
  }

  // ---------- inicialização ----------
  $('btnRun').addEventListener('click', run);
  $('btnPause').addEventListener('click', pause);
  $('btnStep').addEventListener('click', stepOnce);
  $('btnReset').addEventListener('click', restart);
  $('btnReplay').addEventListener('click', () => { if (engine) renderViz(); });
  $('btnAdd').addEventListener('click', () => {
    if (rows.length >= MAX_ITEMS) return;
    rows.push({ name: 'Novo projeto ' + (rows.length + 1), cost: '1000.00', benefit: '1' });
    renderRows(); onEdit();
  });
  PARAM_KEYS.forEach(k => $(k).addEventListener('input', onEdit));
  window.addEventListener('resize', () => { if (engine) drawChart(); });

  renderRows();
  restart();
})();
