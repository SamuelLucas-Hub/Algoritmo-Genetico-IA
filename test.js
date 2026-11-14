// Testes de validação da seção 6. Execute com: node test.js
const GA = require('./ga.js');

const R = v => Math.round(v * 100); // reais -> centavos
const P = v => Math.round(v * 100); // pontos -> centésimos
const projects = [
  { name: 'A', cost: R(4000), benefit: P(7) },
  { name: 'B', cost: R(3000), benefit: P(5) },
  { name: 'C', cost: R(2000), benefit: P(3) },
  { name: 'D', cost: R(5000), benefit: P(8) }
];
const parse = s => s.split('').map(Number);
const bits = g => g.join('');
const money = c => 'R$ ' + (c / 100).toLocaleString('pt-BR');
const pts = v => String(v / 100);
const mk = (s, budget = R(7000)) => GA.makeIndividual(parse(s), projects, budget);

let failures = 0;
function check(label, cond, extra) {
  console.log((cond ? '[OK]    ' : '[FALHA] ') + label + (extra ? ' — ' + extra : ''));
  if (!cond) failures++;
}
const baseCfg = {
  projects, budget: R(7000), popSize: 20, generations: 50,
  crossRate: 0.8, mutRate: 0.05, tournament: 2, elite: 1, seed: 42
};

console.log('\n=== 6.2 Avaliação de uma solução ===');
let ev = GA.evaluate(parse('1100'), projects, R(7000));
console.log(`1100 | orçamento R$ 7.000 -> custo ${money(ev.cost)}; benefício ${pts(ev.benefit)}; saldo ${money(ev.balance)}; viável=${ev.feasible}`);
check('1100 -> custo 7000, benefício 12, saldo 0, viável',
  ev.cost === R(7000) && ev.benefit === P(12) && ev.balance === 0 && ev.feasible);

const expected = {
  '0000': [0, 0], '1000': [4000, 7], '0100': [3000, 5], '0010': [2000, 3], '0001': [5000, 8],
  '1100': [7000, 12], '1010': [6000, 10], '0110': [5000, 8], '0011': [7000, 11]
};
let feasibleCount = 0, tableOk = true;
for (let n = 0; n < 16; n++) {
  const s = n.toString(2).padStart(4, '0');
  const e = GA.evaluate(parse(s), projects, R(7000));
  if (e.feasible) feasibleCount++;
  const exp = expected[s];
  if (e.feasible !== !!exp) tableOk = false;
  if (exp && (e.cost !== R(exp[0]) || e.benefit !== P(exp[1]))) tableOk = false;
}
check('Tabela das 9 soluções viáveis confere; as outras 7 são inviáveis', tableOk && feasibleCount === 9);

console.log('\n=== 6.3 Reparação ===');
let rep = GA.repair(parse('1111'), projects, R(7000));
let chain = ['1111'].concat(rep.steps.map(s => bits(s.genes)));
console.log('Cadeia: ' + chain.join(' → ') + ' | removidos: ' + rep.steps.map(s => projects[s.removed].name).join(', '));
ev = GA.evaluate(parse('1111'), projects, R(7000));
console.log(`1111 -> custo ${money(ev.cost)}; benefício ${pts(ev.benefit)}`);
rep.steps.forEach(s => { const e = GA.evaluate(s.genes, projects, R(7000)); console.log(`${bits(s.genes)} -> custo ${money(e.cost)}; benefício ${pts(e.benefit)}`); });
check('1111 -> 1101 -> 1100 (remove C e depois D)', chain.join(',') === '1111,1101,1100' && rep.steps[0].removed === 2 && rep.steps[1].removed === 3);

console.log('\n=== 6.4 Cruzamento e mutação controlados ===');
const kids = GA.crossover(parse('1100'), parse('0011'), 2);
console.log(`Cruzamento: 11|00 + 00|11 -> filho 1 = ${bits(kids[0])}; filho 2 = ${bits(kids[1])}`);
check('Cruzamento gera 1111 e 0000', bits(kids[0]) === '1111' && bits(kids[1]) === '0000');
const m1 = GA.mutate(kids[0], [0]), m2 = GA.mutate(kids[1], []);
console.log(`Mutação: filho 1 = ${bits(m1)}; filho 2 = ${bits(m2)}`);
check('Mutação gera 0111 e 0000', bits(m1) === '0111' && bits(m2) === '0000');
const r1 = GA.repair(m1, projects, R(7000)), r2 = GA.repair(m2, projects, R(7000));
const c1 = ['0111'].concat(r1.steps.map(s => bits(s.genes)));
console.log('Reparação do filho 1: ' + c1.join(' → ') + ' | filho 2: ' + bits(r2.genes) + ' (sem passos: ' + r2.steps.length + ')');
check('Reparação 0111 -> 0101 -> 0100; filho 2 permanece 0000', c1.join(',') === '0111,0101,0100' && bits(r2.genes) === '0000' && r2.steps.length === 0);
const f1 = GA.makeIndividual(r1.genes, projects, R(7000)), f2 = GA.makeIndividual(r2.genes, projects, R(7000));
console.log(`Avaliação final: filho 1 = ${bits(f1.genes)}, custo ${money(f1.cost)}, aptidão ${pts(f1.fitness)}; filho 2 = ${bits(f2.genes)}, custo ${money(f2.cost)}, aptidão ${pts(f2.fitness)}`);
check('Filho 1: custo 3000, aptidão 5; filho 2: custo 0, aptidão 0',
  f1.cost === R(3000) && f1.fitness === P(5) && f2.cost === 0 && f2.fitness === 0);

console.log('\n--- Limites das taxas (execuções reais do motor) ---');
function runEvents(over) {
  const eng = GA.createEngine(Object.assign({}, baseCfg, over, { generations: 10, popSize: 11 }));
  const pairs = [];
  while (eng.step()) eng.events.filter(e => e.type === 'pair').forEach(e => pairs.push(e));
  return pairs;
}
let pairs = runEvents({ mutRate: 0 });
check('Mutação 0%: nenhum gene invertido (' + pairs.length + ' pares)', pairs.every(p => p.children.every(c => c.flips.length === 0)));
pairs = runEvents({ mutRate: 1 });
check('Mutação 100%: todos os genes dos descendentes invertidos antes da reparação',
  pairs.every(p => p.children.every(c => c.flips.length === 4 && c.afterMutation.every((g, i) => g !== c.afterCross[i]))));
pairs = runEvents({ crossRate: 0 });
check('Cruzamento 0%: filhos copiam os pais',
  pairs.every(p => !p.crossed && bits(p.children[0].afterCross) === bits(p.parentA.genes) && bits(p.children[1].afterCross) === bits(p.parentB.genes)));
pairs = runEvents({ crossRate: 1 });
check('Cruzamento 100%: todos os pares cruzam, corte entre 1 e L-1', pairs.every(p => p.crossed && p.cut >= 1 && p.cut <= 3));

console.log('\n--- Seleção por torneio ---');
const popT = [mk('1000'), mk('0011'), mk('1100')];
const w = GA.tournamentWinner([0, 1, 2], popT);
console.log(`Candidatos 1000 (7), 0011 (11), 1100 (12) -> vencedor: ${bits(popT[w].genes)}`);
check('Vencedor do torneio = 1100', bits(popT[w].genes) === '1100');
const popTie = [mk('1000'), mk('1010'), mk('0001'), mk('0110'), mk('0001'), mk('0100')];
const wt = GA.tournamentWinner([4, 3, 2], popTie);
console.log(`Empate (0001@4, 0110@3, 0001@2; todos aptidão 8) -> vencedor: índice ${wt}`);
check('Empate: vence o menor índice na população (2)', wt === 2);

console.log('\n=== 6.5 Execução completa (semente 42) ===');
const eng = GA.createEngine(baseCfg);
let monotoneBest = true, monotonePop = true, sizeOk = true, stepOk = true, allFeasible = true;
let prevAcc = eng.history[0].bestSoFar, prevPop = eng.history[0].bestFitness;
while (!eng.finished) {
  const g0 = eng.generation;
  eng.step();
  if (eng.generation !== g0 + 1) stepOk = false;
  const h = eng.history[eng.history.length - 1];
  if (h.bestSoFar < prevAcc) monotoneBest = false;
  if (h.bestFitness < prevPop) monotonePop = false;
  prevAcc = h.bestSoFar; prevPop = h.bestFitness;
  if (eng.population.length !== baseCfg.popSize) sizeOk = false;
  if (eng.population.some(p => p.cost > baseCfg.budget)) allFeasible = false;
}
const b = eng.best;
const bev = GA.evaluate(b.genes, projects, R(7000));
console.log(`Melhor: cromossomo ${bits(b.genes)}; custo ${money(b.cost)}; benefício ${pts(b.benefit)}; saldo ${money(b.balance)}; encontrado na geração ${b.generation}`);
console.log('Histórico: ' + eng.history.length + ' registros; geração 0: melhor ' + pts(eng.history[0].bestFitness) + ', média ' + (eng.history[0].avgFitness / 100).toFixed(2) +
  ' | geração 50: melhor ' + pts(eng.history[50].bestFitness) + ', média ' + (eng.history[50].avgFitness / 100).toFixed(2));
check('Histórico com 51 registros (gerações 0..50)', eng.history.length === 51 && eng.history[0].generation === 0 && eng.history[50].generation === 50);
check('Melhor acumulado nunca diminui', monotoneBest);
check('Com elitismo (1), a melhor aptidão da população nunca diminui', monotonePop);
check('Tamanho da população constante (20)', sizeOk);
check('Cada chamada de step() produz exatamente uma geração', stepOk);
check('Toda a população é viável após a reparação', allFeasible);
check('Totais do melhor indivíduo compatíveis com o cromossomo e ≤ orçamento/≤ 12',
  bev.cost === b.cost && bev.benefit === b.benefit && b.cost <= R(7000) && b.benefit <= P(12));
check('step() após o limite não gera nova geração', eng.step() === false && eng.generation === 50);
const eng2 = GA.createEngine(baseCfg); while (eng2.step());
check('Mesma semente e parâmetros -> mesmo histórico (reprodutível)',
  JSON.stringify(eng2.history) === JSON.stringify(eng.history));
const eng3 = GA.createEngine(Object.assign({}, baseCfg, { elite: 0 })); while (eng3.step());
check('Elitismo 0: execução válida (51 registros)', eng3.history.length === 51);
const eng4 = GA.createEngine(Object.assign({}, baseCfg, { popSize: 5, elite: 0 })); eng4.step();
check('População ímpar/pequena mantém tamanho constante (5)', eng4.population.length === 5);

console.log('\n--- Efeito da mutação: 1% vs 20% (sementes 1 a 5) ---');
[0.01, 0.20].forEach(rate => {
  const vals = [];
  for (let seed = 1; seed <= 5; seed++) {
    const e = GA.createEngine(Object.assign({}, baseCfg, { mutRate: rate, seed }));
    while (e.step());
    vals.push(e.best.benefit / 100);
  }
  const mean = vals.reduce((a, c) => a + c, 0) / vals.length;
  console.log(`Mutação ${rate * 100}%: melhores finais = [${vals.join(', ')}]; média = ${mean.toFixed(2)}; atingiram 12: ${vals.filter(v => v === 12).length}/5`);
});

console.log('\n=== 6.6 Limites de orçamento ===');
const e0 = GA.createEngine(Object.assign({}, baseCfg, { budget: 0 }));
let allZero = e0.population.every(p => bits(p.genes) === '0000' && p.cost === 0 && p.fitness === 0);
while (e0.step()) allZero = allZero && e0.population.every(p => bits(p.genes) === '0000');
console.log(`Orçamento R$ 0: população toda 0000 em todas as gerações = ${allZero}; melhor = ${bits(e0.best.genes)} (benefício ${pts(e0.best.benefit)})`);
check('Orçamento 0: toda a população representa 0000', allZero && bits(e0.best.genes) === '0000');
const e14 = GA.evaluate(parse('1111'), projects, R(14000));
console.log(`Orçamento R$ 14.000: 1111 -> custo ${money(e14.cost)}; benefício ${pts(e14.benefit)}; saldo ${money(e14.balance)}; viável=${e14.feasible}`);
check('Orçamento 14.000: 1111 viável, custo 14000, benefício 23, saldo 0',
  e14.feasible && e14.cost === R(14000) && e14.benefit === P(23) && e14.balance === 0);

console.log('\n' + (failures === 0 ? 'TODOS OS TESTES PASSARAM' : failures + ' TESTE(S) FALHARAM'));
process.exit(failures === 0 ? 0 : 1);
