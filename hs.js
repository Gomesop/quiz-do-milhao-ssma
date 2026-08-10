/* Camada padrão Hora da Segurança — cadastro, marca, publicidade e planilha.
   Script clássico: carregar ANTES do módulo do jogo.

   Configure por jogo antes de carregar este arquivo:
     window.HS_CONFIG = { treinamento: 'Nome na planilha', titulo: 'Nome do jogo', subtitulo: '...' };

   API para o jogo:
     HS.exigirCadastro(cb)  — abre o cadastro; chama cb() quando liberado (só na 1ª vez)
     HS.anuncio(cb)         — mostra a tela de patrocínio e chama cb() ao continuar
     HS.concluir(pontos, resultado) — grava a conclusão na planilha (uma vez por partida)
     HS.novaPartida()       — libera novo registro de conclusão
*/

(function () {
  'use strict';

  const CFG = Object.assign({
    treinamento: 'Jogo Hora da Segurança',
    titulo: 'Jogo Hora da Segurança',
    subtitulo: 'Treinamento gamificado · gratuito'
  }, window.HS_CONFIG || {});

  const SHEETS_URL =
    'https://script.google.com/macros/s/AKfycbw77Qz-viys5Kd0qg6fHqGqz5sm4Pay2vJDOGmT89FdZI8BLh3hXOVwj4lfYEJx18Axvw/exec';

  // Cota de patrocínio: marcas fictícias de demonstração.
  // Ao vender, troque os dados e remova `demonstracao: true`.
  const ANUNCIOS = [
    {
      marca: 'ProSeg Soluções', iniciais: 'PS', segmento: 'Consultoria em Segurança do Trabalho',
      tagline: 'Treinamento que muda o comportamento, não só a lista de presença.',
      claim: 'Programas legais, treinamentos de NR e plano de ação auditável, com indicador que a diretoria entende.',
      beneficios: ['PGR e PCMSO', 'Treinamentos de NR', 'Indicadores de SST'],
      cta: 'Conhecer a ProSeg', url: 'https://www.horadaseguranca.com',
      cor1: '#0b3d6b', cor2: '#1565c0', cor3: '#38bdf8', demonstracao: true
    },
    {
      marca: 'Vetor Ambiental', iniciais: 'VA', segmento: 'Gestão de SST e Meio Ambiente',
      tagline: 'Sua empresa tem os laudos. Falta transformá-los em decisão.',
      claim: 'PGR, PCMSO e programas ambientais integrados a indicadores de gestão.',
      beneficios: ['PGR e PCMSO', 'Licenciamento', 'Indicadores de SST'],
      cta: 'Falar com a Vetor', url: 'https://www.horadaseguranca.com',
      cor1: '#14532d', cor2: '#16a34a', cor3: '#a3e635', demonstracao: true
    }
  ];

  const estado = { jogador: null, concluiuPartida: false, contadorAnuncio: 0, aoLiberar: null };

  /* ---------------- planilha ---------------- */

  function enviarPlanilha(dados) {
    const corpo = {
      nome: dados.nome || '', email: dados.email || '',
      treinamento: CFG.treinamento, modo: dados.modo || '',
      etapa: dados.etapa || '',
      pontuacao: dados.pontuacao === undefined ? '' : dados.pontuacao,
      resultado: dados.resultado || ''
    };
    try {
      return fetch(SHEETS_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(corpo)
      }).catch(function () { /* o jogo nunca trava por causa do registro */ });
    } catch (e) { return Promise.resolve(); }
  }

  /* ---------------- marca: topo e rodapé ---------------- */

  function montarMarca() {
    const topo = document.createElement('header');
    topo.className = 'hs-topo';
    topo.innerHTML =
      '<a class="hs-topo-marca" href="https://www.horadaseguranca.com" target="_blank" rel="noopener noreferrer">' +
      '<img src="logo.png" alt="Hora da Segurança"><span><strong>' + CFG.titulo + '</strong>' +
      '<small>' + CFG.subtitulo + '</small></span></a>' +
      '<a class="hs-topo-link" href="https://www.horadaseguranca.com" target="_blank" rel="noopener noreferrer">' +
      'www.horadaseguranca.com</a>';
    document.body.insertBefore(topo, document.body.firstChild);

    const rodape = document.createElement('footer');
    rodape.className = 'hs-rodape';
    rodape.innerHTML =
      '<a href="https://www.horadaseguranca.com" target="_blank" rel="noopener noreferrer">www.horadaseguranca.com</a>' +
      '<span>·</span><a href="anuncie.html" target="_blank" rel="noopener noreferrer">Anuncie neste jogo</a>' +
      '<span>·</span><span>(64) 98446-3639</span>';
    document.body.appendChild(rodape);
  }

  /* ---------------- cadastro ---------------- */

  function montarCadastro() {
    const tela = document.createElement('div');
    // nasce oculto: sem isto a tela cobre o jogo desde o carregamento e o formulário,
    // ainda sem handler, faz submit nativo e recarrega a página
    tela.className = 'hs-tela hs-cadastro hidden';
    tela.id = 'hs-cadastro';
    tela.innerHTML =
      '<div class="hs-card">' +
      '<span class="hs-selo">Treinamento gratuito · Hora da Segurança</span>' +
      '<h2>' + CFG.titulo + '</h2>' +
      '<p class="hs-sub">Preencha para começar. O resultado é registrado no seu nome e serve como comprovação da atividade.</p>' +
      '<form id="hs-form" novalidate>' +
      '<label for="hs-nome">Nome completo</label>' +
      '<input id="hs-nome" type="text" autocomplete="name" placeholder="Seu nome" required>' +
      '<small class="hs-erro hidden" id="hs-erro-nome">Informe seu nome completo.</small>' +
      '<label for="hs-email">E-mail</label>' +
      '<input id="hs-email" type="email" autocomplete="email" placeholder="voce@empresa.com.br" required>' +
      '<small class="hs-erro hidden" id="hs-erro-email">Informe um e-mail válido.</small>' +
      '<label for="hs-empresa">Empresa <span class="hs-opc">(opcional)</span></label>' +
      '<input id="hs-empresa" type="text" autocomplete="organization" placeholder="Onde você trabalha">' +
      '<button type="button" id="hs-enviar" class="hs-btn">Começar o treinamento</button>' +
      '<p class="hs-nota">Seus dados são usados apenas para emitir o resultado do treinamento.</p>' +
      '</form></div>';
    document.body.appendChild(tela);
  }

  function validarEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || '').trim()); }

  /* ---------------- publicidade ---------------- */

  function montarAnuncio() {
    const tela = document.createElement('div');
    tela.className = 'hs-tela hidden';
    tela.id = 'hs-anuncio';
    tela.innerHTML =
      '<div class="hs-ad" id="hs-ad">' +
      '<div class="hs-ad-selo" id="hs-ad-selo">★ Patrocinador oficial deste treinamento</div>' +
      '<div class="hs-ad-topo"><div class="hs-ad-logo" id="hs-ad-logo">PS</div>' +
      '<div><h3 id="hs-ad-marca">—</h3><span id="hs-ad-segmento">—</span></div></div>' +
      '<p class="hs-ad-previa hidden" id="hs-ad-previa"></p>' +
      '<p class="hs-ad-tagline" id="hs-ad-tagline">—</p>' +
      '<p class="hs-ad-claim" id="hs-ad-claim">—</p>' +
      '<div class="hs-ad-chips" id="hs-ad-chips"></div>' +
      '<a class="hs-btn hs-btn-branco" id="hs-ad-cta" href="#" target="_blank" rel="noopener noreferrer">Conhecer</a>' +
      '<p class="hs-ad-demo hidden" id="hs-ad-demo">Marca fictícia de demonstração. <strong>Este espaço está disponível</strong> — ' +
      '<a href="anuncie.html" target="_blank" rel="noopener noreferrer">saiba como anunciar</a>.</p>' +
      '<button type="button" class="hs-btn hs-btn-continuar" id="hs-ad-next" disabled>Continuar em <span id="hs-ad-cont">5</span>s</button>' +
      '<p class="hs-ad-rodape">Espaço publicitário · distribuído por ' +
      '<a href="https://www.horadaseguranca.com" target="_blank" rel="noopener noreferrer">www.horadaseguranca.com</a></p>' +
      '</div>';
    document.body.appendChild(tela);
  }

  function patrocinadorDaURL() {
    try {
      const slug = new URLSearchParams(location.search).get('p');
      return slug && window.HS_PATROCINADORES && window.HS_PATROCINADORES[slug]
        ? window.HS_PATROCINADORES[slug] : null;
    } catch (e) { return null; }
  }

  const HS = {
    pronto: false,

    exigirCadastro: function (cb) {
      if (estado.jogador) { cb && cb(); return; }
      estado.aoLiberar = cb || null;
      document.getElementById('hs-cadastro').classList.remove('hidden');
      setTimeout(function () {
        const primeiro = document.getElementById('hs-nome');
        if (primeiro) primeiro.focus();
      }, 60);
    },

    anuncio: function (cb) {
      const ad = patrocinadorDaURL() || ANUNCIOS[estado.contadorAnuncio % ANUNCIOS.length];
      estado.contadorAnuncio++;

      const card = document.getElementById('hs-ad');
      card.style.background =
        'radial-gradient(circle at 88% 8%, ' + ad.cor3 + '55, transparent 42%), ' +
        'linear-gradient(135deg, ' + ad.cor1 + ', ' + ad.cor2 + ')';

      const caixa = document.getElementById('hs-ad-logo');
      caixa.classList.toggle('hs-ad-logo-img', !!ad.logo);
      caixa.classList.toggle('hs-fundo-escuro', !!ad.logoClaro);
      if (ad.logo) caixa.innerHTML = '<img src="' + ad.logo + '" alt="' + ad.marca + '">';
      else { caixa.textContent = ad.iniciais; caixa.style.color = ad.cor1; }

      document.getElementById('hs-ad-selo').textContent = ad.previa
        ? '★ Espaço reservado para ' + ad.marca
        : '★ Patrocinador oficial deste treinamento';
      const previa = document.getElementById('hs-ad-previa');
      previa.classList.toggle('hidden', !ad.previa);
      previa.textContent = ad.previa
        ? 'Prévia comercial preparada pela Hora da Segurança. Não há relação de patrocínio firmada com esta empresa.' : '';

      document.getElementById('hs-ad-marca').textContent = ad.marca;
      document.getElementById('hs-ad-segmento').textContent = ad.segmento;
      document.getElementById('hs-ad-tagline').textContent = ad.tagline;
      document.getElementById('hs-ad-claim').textContent = ad.claim;

      const chips = document.getElementById('hs-ad-chips');
      chips.innerHTML = '';
      (ad.beneficios || []).forEach(function (b) {
        const s = document.createElement('span');
        s.className = 'hs-ad-chip'; s.textContent = b; chips.appendChild(s);
      });

      const cta = document.getElementById('hs-ad-cta');
      cta.textContent = ad.cta; cta.href = ad.url;
      cta.target = '_blank'; cta.rel = 'noopener noreferrer';
      document.getElementById('hs-ad-demo').classList.toggle('hidden', !ad.demonstracao);

      // o conteúdo do botão é reconstruído a cada exibição: sem isso a 2ª quebra
      const btn = document.getElementById('hs-ad-next');
      btn.disabled = true;
      btn.innerHTML = 'Continuar em <span id="hs-ad-cont">5</span>s';

      document.getElementById('hs-anuncio').classList.remove('hidden');

      let resta = 5;
      clearInterval(HS._timerAd);
      HS._timerAd = setInterval(function () {
        resta--;
        const c = document.getElementById('hs-ad-cont');
        if (c) c.textContent = resta;
        if (resta <= 0) {
          clearInterval(HS._timerAd);
          btn.disabled = false;
          btn.textContent = 'Continuar';
        }
      }, 1000);

      btn.onclick = function () {
        if (btn.disabled) return;
        document.getElementById('hs-anuncio').classList.add('hidden');
        cb && cb();
      };
    },

    concluir: function (pontos, resultado) {
      if (!estado.jogador || estado.concluiuPartida) return;
      estado.concluiuPartida = true;
      enviarPlanilha({
        nome: estado.jogador.nome, email: estado.jogador.email, modo: estado.jogador.empresa,
        etapa: 'Conclusão', pontuacao: pontos, resultado: resultado || ''
      });
    },

    novaPartida: function () { estado.concluiuPartida = false; },
    jogador: function () { return estado.jogador; }
  };

  /* O formulário é preparado já na montagem: assim ele nunca faz submit nativo,
     mesmo que a tela apareça antes de o jogo chamar exigirCadastro. */
  function prepararFormulario() {
    const tela = document.getElementById('hs-cadastro');
    const form = document.getElementById('hs-form');
    if (!form) return;

    // Os jogos usam `* { user-select: none }` e capturam teclado no window:
    // sem isto o clique não dá foco ao campo e o jogador não consegue digitar.
    ['hs-nome', 'hs-email', 'hs-empresa'].forEach(function (id) {
      const campo = document.getElementById(id);
      if (!campo) return;
      ['mousedown', 'touchstart', 'pointerdown'].forEach(function (evt) {
        campo.addEventListener(evt, function () { setTimeout(function () { campo.focus(); }, 0); });
      });
      campo.addEventListener('keydown', function (ev) { ev.stopPropagation(); });
    });

    // O envio é por clique num botão comum: submit de formulário se comportou de
    // forma diferente entre os jogos e chegou a recarregar a página.
    function enviarCadastro(ev) {
      if (ev) ev.preventDefault();
      const nome = document.getElementById('hs-nome').value.trim();
      const email = document.getElementById('hs-email').value.trim();
      const empresa = document.getElementById('hs-empresa').value.trim();
      let ok = true;
      const eNome = document.getElementById('hs-erro-nome');
      const eMail = document.getElementById('hs-erro-email');
      if (nome.length < 3 || nome.split(/\s+/).length < 2) { eNome.classList.remove('hidden'); ok = false; }
      else eNome.classList.add('hidden');
      if (!validarEmail(email)) { eMail.classList.remove('hidden'); ok = false; }
      else eMail.classList.add('hidden');
      if (!ok) return;

      estado.jogador = { nome: nome, email: email, empresa: empresa };
      enviarPlanilha({ nome: nome, email: email, modo: empresa, etapa: 'Inscrição' });
      tela.classList.add('hidden');
      document.activeElement && document.activeElement.blur();
      // a partir daqui o jogador está jogando: no celular o rodapé sai da frente
      document.body.classList.add('hs-jogando');

      const cb = estado.aoLiberar;
      estado.aoLiberar = null;
      if (cb) cb();
    }

    document.getElementById('hs-enviar').addEventListener('click', enviarCadastro);
    form.addEventListener('submit', enviarCadastro);
    // Enter em qualquer campo também envia
    ['hs-nome', 'hs-email', 'hs-empresa'].forEach(function (id) {
      const campo = document.getElementById(id);
      if (!campo) return;
      campo.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); enviarCadastro(); }
      });
    });
  }

  function iniciar() {
    montarMarca();
    montarCadastro();
    prepararFormulario();
    montarAnuncio();
    HS.pronto = true;
    document.dispatchEvent(new CustomEvent('hs-pronto'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();

  window.HS = HS;
})();
