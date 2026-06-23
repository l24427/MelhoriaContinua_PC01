/*
 * githubClient.js — gravação client-side via GitHub Contents API.
 *
 * Lê e grava o machinesData.json direto do navegador, usando um token
 * fine-grained (escopo: só este repo, Contents: read/write) salvo no
 * localStorage. Sem servidor.
 *
 * Fluxo de publicação:
 *   1. getArquivo()  → conteúdo atual + sha
 *   2. (editar o JSON em memória com o DataEngine)
 *   3. publicar(novoJson, sha, mensagem)  → PUT cria o commit; Pages rebuilda.
 *
 * Uso: window.GitHubClient.create({ owner, repo, path, branch })
 */
(function (global) {
  'use strict';

  var TOKEN_KEY = 'mc_gh_token';

  // base64 que preserva UTF-8 (o JSON tem acentos: "Lançar", "Pré-uso").
  function utf8ToBase64(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function base64ToUtf8(b64) {
    var bin = atob(b64.replace(/\n/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function create(cfg) {
    cfg = cfg || {};
    var owner = cfg.owner, repo = cfg.repo;
    var path = cfg.path || 'machinesData.json';
    var branch = cfg.branch || 'main';

    function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
    function setToken(t) { localStorage.setItem(TOKEN_KEY, String(t || '').trim()); }
    function clearToken() { localStorage.removeItem(TOKEN_KEY); }
    function hasToken() { return !!getToken(); }

    function headers() {
      return {
        'Authorization': 'Bearer ' + getToken(),
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      };
    }

    function apiUrl() {
      return 'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path;
    }

    // Valida o token e confirma permissão de escrita no repo.
    function verificarAcesso() {
      return fetch('https://api.github.com/repos/' + owner + '/' + repo, { headers: headers() })
        .then(function (r) {
          if (r.status === 401) throw new Error('Token inválido ou expirado (401).');
          if (r.status === 403) throw new Error('Sem permissão / rate limit (403).');
          if (r.status === 404) throw new Error('Repo não encontrado ou token sem escopo (404).');
          if (!r.ok) throw new Error('Falha ao verificar acesso (' + r.status + ').');
          return r.json();
        })
        .then(function (repoInfo) {
          var perms = repoInfo.permissions || {};
          return { podeEscrever: !!(perms.push || perms.admin || perms.maintain), repo: repoInfo };
        });
    }

    // Retorna { json (string), sha, data (objeto parseado) }
    function getArquivo() {
      return fetch(apiUrl() + '?ref=' + encodeURIComponent(branch) + '&t=' + Date.now(), { headers: headers() })
        .then(function (r) {
          if (!r.ok) throw new Error('Falha ao ler ' + path + ' (' + r.status + ').');
          return r.json();
        })
        .then(function (info) {
          var jsonStr = base64ToUtf8(info.content);
          return { json: jsonStr, sha: info.sha, data: JSON.parse(jsonStr) };
        });
    }

    // Publica o objeto novo. Faz controle de concorrência via sha:
    // se o sha do servidor mudou, lança erro CONFLITO para a UI re-buscar.
    function publicar(novoObj, shaEsperado, mensagem) {
      var jsonStr = JSON.stringify(novoObj, null, 2) + '\n';
      var body = {
        message: mensagem || 'Atualiza machinesData.json via editor',
        content: utf8ToBase64(jsonStr),
        branch: branch
      };
      if (shaEsperado) body.sha = shaEsperado;

      return fetch(apiUrl(), {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers()),
        body: JSON.stringify(body)
      }).then(function (r) {
        if (r.status === 409 || r.status === 422) {
          var e = new Error('CONFLITO: o arquivo mudou no servidor desde a última leitura. Recarregue e tente de novo.');
          e.code = 'CONFLITO';
          throw e;
        }
        if (!r.ok) {
          return r.json().catch(function () { return {}; }).then(function (j) {
            throw new Error('Falha ao publicar (' + r.status + '): ' + (j.message || ''));
          });
        }
        return r.json();
      }).then(function (res) {
        return { commitUrl: res.commit && res.commit.html_url, sha: res.content && res.content.sha };
      });
    }

    return {
      getToken: getToken, setToken: setToken, clearToken: clearToken, hasToken: hasToken,
      verificarAcesso: verificarAcesso, getArquivo: getArquivo, publicar: publicar,
      config: { owner: owner, repo: repo, path: path, branch: branch }
    };
  }

  global.GitHubClient = { create: create, _utf8ToBase64: utf8ToBase64, _base64ToUtf8: base64ToUtf8 };
})(typeof window !== 'undefined' ? window : this);
