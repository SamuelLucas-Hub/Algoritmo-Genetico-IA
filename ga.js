/*
 * ga.js — núcleo do algoritmo genético (implementado do zero, sem bibliotecas).
 * Funciona no navegador (window.GA) e no Node (module.exports), o que permite
 * rodar os testes automatizados do README.
 *
 * Unidades internas (inteiros, para evitar erros de ponto flutuante):
 *   - custo e orçamento: centavos
 *   - benefício: centésimos de ponto
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GA = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // PRNG com semente (mulberry32): retorna números em [0, 1).
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Avalia um cromossomo (sem reparar).
  function evaluate(genes, projects, budget) {
    let cost = 0, benefit = 0;
    for (let i = 0; i < genes.length; i++) {
      if (genes[i] === 1) { cost += projects[i].cost; benefit += projects[i].benefit; }
    }
    return { cost, benefit, balance: budget - cost, feasible: cost <= budget };
  }

  // razão benefício/custo de i é MENOR que a de j?  (b_i/c_i < b_j/c_j, exato via BigInt)
  function ratioLess(pi, pj) {
    return BigInt(pi.benefit) * BigInt(pj.cost) < BigInt(pj.benefit) * BigInt(pi.cost);
  }

  // Reparação: enquanto custo > orçamento, remove o selecionado de menor razão
  // benefício/custo (empate: menor índice).
  function repair(genes, projects, budget) {
    const g = genes.slice();
    const steps = [];
    let ev = evaluate(g, projects, budget);
    while (ev.cost > budget) {
      let worst = -1;
      for (let i = 0; i < g.length; i++) {
        if (g[i] === 1 && (worst === -1 || ratioLess(projects[i], projects[worst]))) worst = i;
      }
      g[worst] = 0;
      steps.push({ removed: worst, genes: g.slice() });
      ev = evaluate(g, projects, budget);
    }
    return { genes: g, steps };
  }

  function makeIndividual(genes, projects, budget) {
    const ev = evaluate(genes, projects, budget);
    return { genes: genes.slice(), cost: ev.cost, benefit: ev.benefit, balance: ev.balance, fitness: ev.benefit };
  }

  // Cruzamento de um ponto: o corte é a quantidade de genes à esquerda (corte após o gene `cut`).
  function crossover(p1, p2, cut) {
    return [p1.slice(0, cut).concat(p2.slice(cut)), p2.slice(0, cut).concat(p1.slice(cut))];
  }

  // Mutação por inversão de bits nos índices informados.
  function mutate(genes, flipIndexes) {
    const g = genes.slice();
    flipIndexes.forEach(function (i) { g[i] = g[i] === 1 ? 0 : 1; });
    return g;
  }

  // Vencedor do torneio: maior aptidão; empate -> menor índice na população.
  function tournamentWinner(candidates, population) {
    let winner = candidates[0];
    for (let k = 1; k < candidates.length; k++) {
      const c = candidates[k];
      const fc = population[c].fitness, fw = population[winner].fitness;
      if (fc > fw || (fc === fw && c < winner)) winner = c;
    }
    return winner;
  }

  function cloneInd(ind) {
    return Object.assign({}, ind, { genes: ind.genes.slice() });
  }

  /*
   * cfg: { projects:[{name,cost,benefit}], budget, popSize, generations,
   *        crossRate (0..1), mutRate (0..1), tournament, elite, seed }
   */
  function createEngine(cfg) {
    const rng = mulberry32(cfg.seed);
    const projects = cfg.projects, budget = cfg.budget;
    const L = projects.length, N = cfg.popSize;
    let population = [], generation = 0, history = [], best = null, events = [];

    function fromRaw(raw) {
      const rep = repair(raw, projects, budget);
      return { ind: makeIndividual(rep.genes, projects, budget), steps: rep.steps };
    }

    function record() {
      let bestFit = -Infinity, bestIdx = 0, sum = 0;
      population.forEach(function (p, i) {
        sum += p.fitness;
        if (p.fitness > bestFit) { bestFit = p.fitness; bestIdx = i; }
      });
      if (!best || bestFit > best.fitness) {
        best = Object.assign(cloneInd(population[bestIdx]), { generation: generation });
      }
      history.push({ generation: generation, bestFitness: bestFit, avgFitness: sum / N, bestSoFar: best.fitness });
    }

    // Seleciona k candidatos distintos (Fisher–Yates parcial) e devolve o vencedor.
    function pickParent() {
      const idx = [];
      for (let i = 0; i < N; i++) idx.push(i);
      for (let i = 0; i < cfg.tournament; i++) {
        const j = i + Math.floor(rng() * (N - i));
        const tmp = idx[i]; idx[i] = idx[j]; idx[j] = tmp;
      }
      const candidates = idx.slice(0, cfg.tournament);
      return { index: tournamentWinner(candidates, population), candidates: candidates };
    }

    // Geração 0: cada gene sorteado com probabilidade 0,5; depois reparação.
    (function init() {
      for (let i = 0; i < N; i++) {
        const raw = [];
        for (let g = 0; g < L; g++) raw.push(rng() < 0.5 ? 1 : 0);
        const r = fromRaw(raw);
        population.push(r.ind);
        events.push({ type: 'init', index: i, raw: raw, steps: r.steps, individual: r.ind });
      }
      record();
    })();

    function step() {
      if (generation >= cfg.generations) return false;
      const next = [], ev = [];

      // Elitismo: cópia sem modificação dos melhores (empate: menor índice).
      const order = population.map(function (_, i) { return i; }).sort(function (a, b) {
        return (population[b].fitness - population[a].fitness) || (a - b);
      });
      for (let r = 0; r < cfg.elite; r++) {
        next.push(cloneInd(population[order[r]]));
        ev.push({ type: 'elite', rank: r + 1, fromIndex: order[r], individual: population[order[r]] });
      }

      // Demais vagas: descendentes; pais sempre da população anterior.
      while (next.length < N) {
        const pa = pickParent(), pb = pickParent();
        const A = population[pa.index], B = population[pb.index];
        let crossed = false, cut = null, c1 = A.genes.slice(), c2 = B.genes.slice();
        if (rng() < cfg.crossRate) {
          crossed = true;
          cut = 1 + Math.floor(rng() * (L - 1)); // entre o 1º e o penúltimo gene
          const kids = crossover(A.genes, B.genes, cut);
          c1 = kids[0]; c2 = kids[1];
        }
        const afterCross = [c1, c2];
        const flips = [[], []];
        const afterMut = afterCross.map(function (c, k) {
          for (let g = 0; g < L; g++) if (rng() < cfg.mutRate) flips[k].push(g);
          return mutate(c, flips[k]);
        });
        const reps = afterMut.map(fromRaw);
        const keepSecond = (N - next.length) >= 2; // sobrando 1 vaga: só o 1º filho do último par
        next.push(reps[0].ind);
        if (keepSecond) next.push(reps[1].ind);

        ev.push({
          type: 'pair',
          parentA: { index: pa.index, genes: A.genes.slice(), candidates: pa.candidates },
          parentB: { index: pb.index, genes: B.genes.slice(), candidates: pb.candidates },
          crossed: crossed, cut: cut,
          children: [0, 1].map(function (k) {
            return {
              afterCross: afterCross[k], flips: flips[k], afterMutation: afterMut[k],
              repairSteps: reps[k].steps, individual: reps[k].ind,
              kept: k === 0 ? true : keepSecond
            };
          })
        });
      }

      population = next;
      generation++;
      events = ev;
      record();
      return true;
    }

    return {
      step: step,
      config: cfg,
      get generation() { return generation; },
      get finished() { return generation >= cfg.generations; },
      get population() { return population; },
      get history() { return history; },
      get best() { return best; },
      get events() { return events; }
    };
  }

  return {
    mulberry32: mulberry32, evaluate: evaluate, repair: repair, makeIndividual: makeIndividual,
    crossover: crossover, mutate: mutate, tournamentWinner: tournamentWinner, createEngine: createEngine
  };
}));
