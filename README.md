# Simulador de Algoritmo Genético — Seleção de Projetos do Campus

Atividade Prática de **Inteligência Artificial**.

**Autores:** _Luidge de Sousa, Samuel Lucas Alves Matos_

**Aplicação publicada (GitHub Pages):** https://samuellucas-hub.github.io/Atividade-Pratica-IA/
**Repositório:** https://github.com/SamuelLucas-Hub/Atividade-Pratica-IA/tree/Algoritmo-genetico

## 1. Descrição da solução

Simulador, executado inteiramente no navegador (HTML + CSS + JavaScript, sem servidor), que usa um algoritmo genético para escolher projetos de melhoria de um campus maximizando a soma dos benefícios sem ultrapassar o orçamento (problema da mochila 0/1).

- **Cromossomo:** vetor binário, um gene por projeto (`1` = selecionado, `0` = excluído). Ex.: `1010` seleciona o 1º e o 3º projetos.
- **População inicial:** cada gene sorteado independentemente com 50% de chance de 0 e de 1.
- **Reparação** (aplicada à população inicial e a todo descendente, antes da avaliação): enquanto o custo ultrapassar o orçamento, remove-se o projeto selecionado de **menor razão benefício/custo**; em empate, o de **menor índice**. A razão é comparada por multiplicação cruzada com inteiros (`BigInt`), sem divisão em ponto flutuante.
- **Aptidão:** benefício total da solução já reparada. Seleção vazia é válida (aptidão 0).
- **Seleção:** torneio com candidatos **distintos**; vence a maior aptidão; empate → menor índice na população. Cada pai vem de um torneio independente.
- **Cruzamento de um ponto:** aplicado **por par** com a taxa configurada; corte sorteado entre o 1º e o penúltimo gene.
- **Mutação:** inversão de bits, sorteada **independentemente por gene** de cada descendente.
- **Elitismo:** os `k` melhores indivíduos (empate → menor índice) são copiados sem modificação; as demais vagas são preenchidas com descendentes, com pais sempre da população anterior. Se sobrar uma única vaga, só o 1º filho do último par é mantido. Tamanho da população constante; repetidos são permitidos.
- **Término:** após o número configurado de gerações (a população inicial é a geração 0). Exibe-se a melhor solução de **toda a execução**.
- **Dinheiro e pontos** são guardados como inteiros (centavos e centésimos de ponto), evitando erros de arredondamento.
- **Números aleatórios:** gerador próprio com semente (mulberry32, em `ga.js`), para reproduzir execuções.

### Arquivos

| Arquivo | Função |
|---|---|
| `index.html`, `style.css` | Página e estilo |
| `app.js` | Interface: campos, validação, controles, gráfico, tabela, logs e animação |
| `ga.js` | Algoritmo genético (funciona no navegador e no Node) |
| `test.js` | Testes automatizados da seção 6 (`node test.js`) |

## 2. Instruções de uso

1. Abra `index.html` no navegador (ou acesse o link do GitHub Pages). Não há login nem instalação.
2. A aplicação inicia com o exemplo da seção 6.1 (4 projetos, orçamento R$ 7.000) e a população inicial (geração 0) já criada.
3. Edite nomes, custos e benefícios, adicione ou remova projetos (entre 4 e 15) e ajuste os parâmetros.
4. **Executar** roda até o limite de gerações (a velocidade é ajustável); **Pausar** preserva o estado e **Executar** o retoma; **Avançar uma geração** produz exatamente uma geração e permanece pausado; **Reiniciar** limpa o histórico e restabelece a semente.
5. Qualquer alteração em dados ou parâmetros exige **Reiniciar** (Executar e Avançar ficam bloqueados até lá).
6. Acompanhe: métricas (geração atual, melhor da geração, média, melhor acumulado), gráfico, melhor solução (cromossomo, projetos, custo, benefício, saldo), **animação passo a passo** da última geração (pais, corte, troca de segmentos, bits mutados, reparações e elite), log textual e tabela do histórico.

Em custos, benefícios e orçamento use ponto **ou** vírgula como separador decimal (até 2 casas), **sem** separador de milhar (`7000` ou `7000,50`; `7.000` é rejeitado de propósito, para não ser lido como R$ 7,00).

### Parâmetros e validação

| Campo | Regra |
|---|---|
| Projetos | nome não vazio; custo > 0 (até 2 casas); benefício ≥ 0 (até 2 casas); entre 4 e 15 itens |
| Orçamento | valor ≥ 0, até 2 casas |
| Tamanho da população | inteiro ≥ 2 |
| Número de gerações | inteiro ≥ 1 |
| Taxa de cruzamento | 0% a 100%, por par |
| Taxa de mutação | 0% a 100%, por gene |
| Tamanho do torneio | inteiro entre 2 e o tamanho da população |
| Indivíduos de elite | inteiro entre 0 e população − 1 |
| Semente | inteiro |

Campos vazios ou inválidos são marcados em vermelho com a mensagem e bloqueiam Executar, Avançar e Reiniciar. Por segurança de desempenho, população e gerações aceitam até 6 dígitos. Nos logs e na animação, os índices de população começam em 0.

## 3. Bibliotecas auxiliares

**Nenhuma.** Todo o código (algoritmo genético, gerador pseudoaleatório com semente, gráfico em `<canvas>`, interface e animações em CSS) foi escrito pelos autores.

## 4. Resultados dos testes (seção 6)

Todos os resultados abaixo foram produzidos por `node test.js` (saída: **TODOS OS TESTES PASSARAM**).

### 6.2 Avaliação de uma solução

- Entrada: `1100`, orçamento R$ 7.000.
- Saída obtida: custo R$ 7.000; benefício 12; saldo R$ 0; viável; aptidão 12 (**igual ao esperado**).
- Enumeração dos 16 cromossomos: exatamente 9 são viáveis e todos coincidem com a tabela da atividade (`0000, 1000, 0100, 0010, 0001, 1100, 1010, 0110, 0011`); as outras 7 combinações são inviáveis.

### 6.3 Reparação

- Entrada: `1111`, orçamento R$ 7.000.
- Saída obtida: `1111` (R$ 14.000; 23) → remove C → `1101` (R$ 12.000; 20) → remove D → `1100` (R$ 7.000; 12; viável). **Exata**, como esperado.

### 6.4 Cruzamento e mutação controlados

- Cruzamento `11|00 + 00|11` → filho 1 = `1111`; filho 2 = `0000`.
- Mutação só do 1º gene do filho 1 → `0111`; filho 2 = `0000`.
- Reparação do filho 1: `0111 → 0101 → 0100` (remove C e depois D); filho 2 permanece `0000`.
- Avaliação final: filho 1 = `0100`, custo R$ 3.000, aptidão 5; filho 2 = `0000`, custo R$ 0, aptidão 0. **Tudo igual ao esperado.**
- **Limites das taxas** (verificados em execuções reais do motor): mutação 0% → nenhum gene invertido; mutação 100% → todos os genes dos descendentes invertidos antes da reparação; cruzamento 0% → filhos copiam os pais; cruzamento 100% → todos os pares cruzam, com corte entre 1 e L−1. Cruzamento, mutação e reparação são registrados separadamente nos eventos, no log e na animação.
- **Torneio isolado:** candidatos `1000` (7), `0011` (11) e `1100` (12) → vencedor `1100`. **Empate:** candidatos `0001` (índice 4), `0110` (índice 3) e `0001` (índice 2), todos com aptidão 8 → vence o índice 2 (menor índice na população).

### 6.5 Execução completa

Configuração: dados da 6.1; população 20; 50 gerações; cruzamento 80%; mutação 5% por gene; torneio 2; 1 elite; **semente 42**.

- Melhor solução: cromossomo `1100`; projetos A e B; custo R$ 7.000; benefício 12; saldo R$ 0 (igual ao ótimo de referência). Foi encontrada já na geração 0.
- Histórico com **51 registros** (gerações 0 a 50). Geração 0: melhor 12, média 7,60. Geração 50: melhor 12, média 11,15.
- Verificações aprovadas: melhor acumulado nunca diminui; com 1 elite, a melhor aptidão da população nunca diminui; população constante em 20; cada `step()` gera exatamente uma geração; toda a população é viável após a reparação; custo e benefício do melhor indivíduo são compatíveis com o cromossomo (≤ R$ 7.000 e ≤ 12); mesma semente e parâmetros reproduzem o mesmo histórico.

**Efeito da mutação (1% vs 20%)**, demais parâmetros iguais, sementes 1 a 5:

| Mutação | Melhor benefício final (sementes 1–5) | Média | Execuções que atingiram 12 | 1ª geração com benefício 12 | Aptidão média da população (média das gerações 41–50 e das 5 sementes) |
|---|---|---|---|---|---|
| 1% | 12, 12, 12, 12, 12 | **12,00** | **5 de 5** | 0, 0, 2, 0, 0 | 11,87 |
| 20% | 12, 12, 12, 12, 12 | **12,00** | **5 de 5** | 0, 0, 1, 0, 0 | 9,54 |

**Interpretação:** nas duas configurações todas as execuções chegaram ao ótimo, então o melhor benefício final **não distingue** as taxas. Isso ocorre porque o espaço de busca é minúsculo (apenas 16 cromossomos) e a população tem 20 indivíduos: o ótimo costuma já aparecer na população inicial (geração 0 em 4 de 5 sementes, em ambas as taxas), e o elitismo o preserva. Não se pode concluir que uma taxa seja melhor que a outra quanto a encontrar o ótimo. A diferença aparece na **qualidade média da população**: com 20% de mutação cada gene de cada filho muda em um quinto dos casos, o que destrói boas soluções com frequência e mantém a média em torno de 9,5; com 1% a população converge para perto do ótimo (média ≈ 11,9). A mutação alta traz mais diversidade e exploração, mas atrapalha a convergência; a baixa converge melhor, com risco de perder diversidade em problemas maiores e mais difíceis, o que esta instância não revela. Apenas 5 sementes por configuração é uma amostra pequena.

### 6.6 Limites de orçamento

- Orçamento R$ 0: após a reparação, **toda** a população é `0000` (custo, benefício e aptidão 0) na geração inicial e em todas as gerações seguintes; o melhor resultado é `0000`.
- Orçamento R$ 14.000: a avaliação de `1111` retorna custo R$ 14.000, benefício 23, saldo R$ 0, viável.

## 5. Executar os testes

```bash
node test.js
```

## 6. Publicação no GitHub Pages

1. Crie um repositório **público** e envie todos os arquivos desta pasta.
2. No repositório: *Settings → Pages → Build and deployment → Deploy from a branch → `main` / raiz → Save*.
3. Em `index.html`, troque o `href` do link `repoLink` (`https://github.com/SEU-USUARIO/SEU-REPOSITORIO`) pelo endereço real do repositório.
4. Preencha autores e links no topo deste README.
