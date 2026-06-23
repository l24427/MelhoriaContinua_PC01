// Testa o dataEngine.js contra o machinesData.json migrado (Node).
const fs = require('fs');
const path = require('path');
const ROOT = path.dirname(__dirname);
const DataEngine = require(path.join(ROOT, 'dataEngine.js'));
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'machinesData.json'), 'utf8'));

let pass = 0, fail = 0;
function check(nome, cond) { (cond ? (pass++, console.log('  OK  ' + nome)) : (fail++, console.log(' FAIL ' + nome))); }

function novo() { return DataEngine.create(JSON.parse(JSON.stringify(data))); }

// Estrutura básica
let e = novo();
check('categorias existem', e.listCategorias().length >= 1);
check('areas = 5', e.listAreas().length === 5);
const totalInicial = e.resolveSeletor({ categorias: 'ALL', maquinas: 'ALL', areas: 'ALL' }).length;
check('total de botões = 698', totalInicial === 698);

// Caso 4: editar 1 botão de 1 máquina (AC20/EHS/"Lançar Safe")
e = novo();
let cat = e.categoriaDaMaquina('AC20');
let antes = e.listBotoes(cat, 'AC20', 'EHS').find(b => b.texto === 'Lançar Safe');
check('botão alvo existe', !!antes);
e.updateBotao({ categoria: cat, maquina: 'AC20', area: 'EHS', texto: 'Lançar Safe' }, { href: 'https://novo.exemplo/safe' });
let depois = e.listBotoes(cat, 'AC20', 'EHS').find(b => b.texto === 'Lançar Safe');
check('href atualizado (1 botão)', depois.href === 'https://novo.exemplo/safe');

// Caso 2: mesmo botão (texto) em TODAS as máquinas de TODAS as categorias
e = novo();
let escGlobal = { categorias: 'ALL', maquinas: 'ALL', areas: 'ALL', matchTexto: 'Lançar Safe', matchExato: true };
let alvosGlobais = e.resolveSeletor(escGlobal).length;
check('Lançar Safe em várias máquinas', alvosGlobais > 1);
e.applyOperacao({ tipo: 'setHref', escopo: escGlobal, href: 'https://global/safe' });
let conferidos = e.resolveSeletor(escGlobal).every(loc => loc.botao.href === 'https://global/safe');
check('href global aplicado a todos', conferidos);

// Caso 3: mesmo nome numa ÚNICA categoria
e = novo();
let umaCat = e.listCategorias().find(c => e.listMaquinas(c).length > 1) || e.listCategorias()[0];
let escCat = { categorias: [umaCat], maquinas: 'ALL', areas: 'ALL', matchTexto: 'Lançar Safe', matchExato: true };
let nCat = e.resolveSeletor(escCat).length;
e.applyOperacao({ tipo: 'setHref', escopo: escCat, href: 'https://cat/safe' });
let soNaCat = e.resolveSeletor({ categorias: [umaCat], maquinas: 'ALL', areas: 'ALL', matchTexto: 'Lançar Safe' }).every(l => l.botao.href === 'https://cat/safe');
check('href aplicado só na categoria (' + umaCat + ', ' + nCat + ' botões)', soNaCat && nCat >= 1);

// Caso 1: 3 edições distintas + inserir botão novo, num changeset
e = novo();
let c1 = e.categoriaDaMaquina('FB14'), c2 = e.categoriaDaMaquina('AF16'), c3 = e.categoriaDaMaquina('CM01');
let ops = [
  { tipo: 'setHref', escopo: { categorias: [c1], maquinas: ['FB14'], areas: ['EHS'], matchTexto: e.listBotoes(c1,'FB14','EHS')[0].texto }, href: 'https://x/ehs-fb14' },
  { tipo: 'setHref', escopo: { categorias: [c2], maquinas: ['AF16'], areas: ['QUALIDADE'], matchTexto: e.listBotoes(c2,'AF16','QUALIDADE')[0].texto }, href: 'https://x/qual-af16' },
  { tipo: 'addBotao', categoria: c3, maquina: 'CM01', area: 'PRODUTIVIDADE', texto: 'Manutenção', href: 'https://x/manut-cm01' }
];
let totalAntes = e.resolveSeletor({ categorias:'ALL', maquinas:'ALL', areas:'ALL' }).length;
e.applyChangeset(ops);
let totalDepois = e.resolveSeletor({ categorias:'ALL', maquinas:'ALL', areas:'ALL' }).length;
check('changeset inseriu 1 botão (Manutenção)', totalDepois === totalAntes + 1);
check('novo botão Manutenção presente', e.listBotoes(c3,'CM01','PRODUTIVIDADE').some(b => b.texto === 'Manutenção'));

// Caso 5: apagar um botão
e = novo();
let cat5 = e.categoriaDaMaquina('AC20');
let nA = e.listBotoes(cat5, 'AC20', 'EHS').length;
e.deleteBotao({ categoria: cat5, maquina: 'AC20', area: 'EHS', texto: 'Lançar Safe' });
let nB = e.listBotoes(cat5, 'AC20', 'EHS').length;
check('botão apagado (1 a menos)', nB === nA - 1);

console.log('\nRESULTADO: ' + pass + ' OK, ' + fail + ' FAIL');
process.exit(fail ? 1 : 0);
