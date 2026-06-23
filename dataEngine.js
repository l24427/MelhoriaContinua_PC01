/*
 * dataEngine.js — motor de dados do quadro de melhoria contínua.
 *
 * Modelo:
 *   data = {
 *     areas: ["EHS", ...],                       // lista canônica/ordenada
 *     categorias: { <categoria>: { <maquina>: { <area>: [ {texto, href}, ... ] } } }
 *   }
 *
 * Toda escrita acontece no objeto em memória. O seletor de escopo unifica as
 * edições pontuais e em massa. As operações são objetos serializáveis, o que
 * permite enfileirar um changeset, pré-visualizar e publicar tudo num commit.
 *
 * Uso (browser): <script src="dataEngine.js"></script>  →  window.DataEngine
 */
(function (global) {
  'use strict';

  var ALL = 'ALL';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function norm(s) { return (s == null ? '' : String(s)).trim().toLowerCase(); }

  function createEngine(initial) {
    var data = initial || { areas: [], categorias: {} };
    if (!data.areas) data.areas = [];
    if (!data.categorias) data.categorias = {};

    /* ---------- leitura ---------- */

    function getData() { return data; }
    function setData(d) { data = d; if (!data.areas) data.areas = []; if (!data.categorias) data.categorias = {}; }

    function listCategorias() { return Object.keys(data.categorias).sort(); }

    function listMaquinas(cat) {
      if (cat) return Object.keys(data.categorias[cat] || {}).sort();
      var set = {};
      listCategorias().forEach(function (c) {
        Object.keys(data.categorias[c]).forEach(function (m) { set[m] = true; });
      });
      return Object.keys(set).sort();
    }

    function listAreas() { return data.areas.slice(); }

    function categoriaDaMaquina(maq) {
      var cats = listCategorias();
      for (var i = 0; i < cats.length; i++) {
        if (data.categorias[cats[i]][maq]) return cats[i];
      }
      return null;
    }

    function listBotoes(cat, maq, area) {
      var c = data.categorias[cat]; if (!c) return [];
      var m = c[maq]; if (!m) return [];
      return m[area] || [];
    }

    /* ---------- helpers estruturais ---------- */

    function ensureCategoria(nome) {
      if (!data.categorias[nome]) data.categorias[nome] = {};
      return data.categorias[nome];
    }

    function ensureMaquina(cat, maq) {
      var c = ensureCategoria(cat);
      if (!c[maq]) {
        c[maq] = {};
        // toda máquina recebe TODAS as áreas (padronizadas), mesmo vazias
        data.areas.forEach(function (a) { c[maq][a] = []; });
      }
      return c[maq];
    }

    function addCategoria(nome) {
      nome = String(nome || '').trim();
      if (!nome) throw new Error('Categoria sem nome.');
      ensureCategoria(nome);
    }

    function addMaquina(cat, maq) {
      maq = String(maq || '').trim();
      if (!maq) throw new Error('Máquina sem nome.');
      ensureMaquina(cat, maq);
    }

    function addArea(nome) {
      nome = String(nome || '').trim();
      if (!nome) throw new Error('Área sem nome.');
      if (data.areas.indexOf(nome) === -1) data.areas.push(nome);
      // garante a área (vazia) em todas as máquinas
      listCategorias().forEach(function (c) {
        Object.keys(data.categorias[c]).forEach(function (m) {
          if (!data.categorias[c][m][nome]) data.categorias[c][m][nome] = [];
        });
      });
    }

    function moveMaquina(maq, deCat, paraCat) {
      var origem = data.categorias[deCat];
      if (!origem || !origem[maq]) throw new Error('Máquina ' + maq + ' não está em ' + deCat + '.');
      ensureCategoria(paraCat);
      data.categorias[paraCat][maq] = origem[maq];
      delete origem[maq];
    }

    function renameCategoria(de, para) {
      para = String(para || '').trim();
      if (!data.categorias[de]) throw new Error('Categoria ' + de + ' inexistente.');
      if (!para || de === para) return;
      ensureCategoria(para);
      Object.keys(data.categorias[de]).forEach(function (m) {
        data.categorias[para][m] = data.categorias[de][m];
      });
      delete data.categorias[de];
    }

    /* ---------- CRUD de botões ---------- */

    function addBotao(cat, maq, area, botao) {
      if (!botao || !String(botao.texto || '').trim()) throw new Error('Botão sem texto.');
      var node = ensureMaquina(cat, maq);
      if (data.areas.indexOf(area) === -1) addArea(area);
      if (!node[area]) node[area] = [];
      node[area].push({ texto: String(botao.texto).trim(), href: String(botao.href || '').trim() });
    }

    // sel: { categoria, maquina, area, texto } ou { categoria, maquina, area, idx }
    function localizarBotao(sel) {
      var arr = listBotoes(sel.categoria, sel.maquina, sel.area);
      if (typeof sel.idx === 'number') return sel.idx >= 0 && sel.idx < arr.length ? sel.idx : -1;
      for (var i = 0; i < arr.length; i++) {
        if (norm(arr[i].texto) === norm(sel.texto)) return i;
      }
      return -1;
    }

    function updateBotao(sel, patch) {
      var arr = listBotoes(sel.categoria, sel.maquina, sel.area);
      var i = localizarBotao(sel);
      if (i === -1) throw new Error('Botão não encontrado: ' + JSON.stringify(sel));
      if (patch.texto != null) arr[i].texto = String(patch.texto).trim();
      if (patch.href != null) arr[i].href = String(patch.href).trim();
    }

    function deleteBotao(sel) {
      var arr = listBotoes(sel.categoria, sel.maquina, sel.area);
      var i = localizarBotao(sel);
      if (i === -1) throw new Error('Botão não encontrado: ' + JSON.stringify(sel));
      arr.splice(i, 1);
    }

    /* ---------- seletor de escopo (edição em massa) ---------- */

    function inScope(valor, escopoCampo) {
      if (escopoCampo === ALL || escopoCampo == null) return true;
      if (Array.isArray(escopoCampo)) return escopoCampo.indexOf(valor) !== -1;
      return escopoCampo === valor;
    }

    // escopo: { categorias:[]|"ALL", maquinas:[]|"ALL", areas:[]|"ALL", matchTexto?, matchExato? }
    // retorna [{ categoria, maquina, area, idx, botao }]
    function resolveSeletor(escopo) {
      escopo = escopo || {};
      var out = [];
      var quer = escopo.matchTexto != null ? norm(escopo.matchTexto) : null;
      listCategorias().forEach(function (cat) {
        if (!inScope(cat, escopo.categorias)) return;
        Object.keys(data.categorias[cat]).sort().forEach(function (maq) {
          if (!inScope(maq, escopo.maquinas)) return;
          var areas = data.categorias[cat][maq];
          Object.keys(areas).forEach(function (area) {
            if (!inScope(area, escopo.areas)) return;
            areas[area].forEach(function (botao, idx) {
              if (quer != null) {
                var t = norm(botao.texto);
                var hit = escopo.matchExato === false ? t.indexOf(quer) !== -1 : t === quer;
                if (!hit) return;
              }
              out.push({ categoria: cat, maquina: maq, area: area, idx: idx, botao: botao });
            });
          });
        });
      });
      return out;
    }

    /* ---------- operações (changeset) ----------
     * Cada operação é um objeto serializável. Aplicar a mesma lista garante
     * idempotência lógica para publicação num único commit.
     */
    function applyOperacao(op) {
      switch (op.tipo) {
        case 'addCategoria': return addCategoria(op.nome);
        case 'renameCategoria': return renameCategoria(op.de, op.para);
        case 'addMaquina': return addMaquina(op.categoria, op.maquina);
        case 'moveMaquina': return moveMaquina(op.maquina, op.de, op.para);
        case 'addArea': return addArea(op.nome);
        case 'addBotao':
        case 'insert':
          return addBotao(op.categoria, op.maquina, op.area, { texto: op.texto, href: op.href });
        case 'updateBotao':
          return updateBotao(op.sel, op.patch);
        case 'deleteBotao':
          return deleteBotao(op.sel);
        case 'setHref':
          return resolveSeletor(op.escopo).forEach(function (loc) { loc.botao.href = String(op.href || '').trim(); });
        case 'renameTexto':
          return resolveSeletor(op.escopo).forEach(function (loc) { loc.botao.texto = String(op.novoTexto || '').trim(); });
        case 'deleteEscopo': {
          // apaga de trás pra frente para preservar índices
          var locs = resolveSeletor(op.escopo).sort(function (a, b) { return b.idx - a.idx; });
          locs.forEach(function (loc) { listBotoes(loc.categoria, loc.maquina, loc.area).splice(loc.idx, 1); });
          return;
        }
        default:
          throw new Error('Operação desconhecida: ' + op.tipo);
      }
    }

    function applyChangeset(ops) { (ops || []).forEach(applyOperacao); }

    // Conta quantos botões uma operação afeta, sem alterar o estado.
    function preverImpacto(op) {
      if (op.tipo === 'setHref' || op.tipo === 'renameTexto' || op.tipo === 'deleteEscopo') {
        return resolveSeletor(op.escopo).length;
      }
      return 1;
    }

    return {
      ALL: ALL,
      getData: getData, setData: setData, clone: function () { return clone(data); },
      listCategorias: listCategorias, listMaquinas: listMaquinas, listAreas: listAreas,
      listBotoes: listBotoes, categoriaDaMaquina: categoriaDaMaquina,
      addCategoria: addCategoria, renameCategoria: renameCategoria,
      addMaquina: addMaquina, moveMaquina: moveMaquina, addArea: addArea,
      addBotao: addBotao, updateBotao: updateBotao, deleteBotao: deleteBotao,
      resolveSeletor: resolveSeletor,
      applyOperacao: applyOperacao, applyChangeset: applyChangeset, preverImpacto: preverImpacto
    };
  }

  var DataEngine = { create: createEngine, ALL: ALL };

  if (typeof module !== 'undefined' && module.exports) module.exports = DataEngine;
  global.DataEngine = DataEngine;
})(typeof window !== 'undefined' ? window : this);
