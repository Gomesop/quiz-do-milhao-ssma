import { GameEngine, PRIZE_LADDER } from './game.js';
import { sound } from './audio.js';

class ShowDoMilhaoUI {
  constructor() {
    this.game = new GameEngine();

    // DOM Elements
    this.hostMessage = document.getElementById('host-message');
    this.questionNumber = document.getElementById('question-number');
    this.questionCategory = document.getElementById('question-category');
    this.questionText = document.getElementById('question-text');
    this.optionBtns = document.querySelectorAll('.btn-option');
    this.confirmPanel = document.getElementById('confirm-panel');

    this.valWin = document.getElementById('val-win');
    this.valStop = document.getElementById('val-stop');
    this.valLose = document.getElementById('val-lose');
    this.prizeLadderList = document.getElementById('prize-ladder');

    // Lifeline buttons
    this.btnUniv = document.getElementById('help-univ');
    this.btnCards = document.getElementById('help-cards');
    this.btnPlates = document.getElementById('help-plates');
    this.btnSkip = document.getElementById('help-skip');
    this.skipCount = document.getElementById('skip-count');

    // Modals
    this.modalScreen = document.getElementById('modal-screen');
    this.modalCards = document.getElementById('modal-cards');
    this.modalPlates = document.getElementById('modal-plates');
    this.modalUniv = document.getElementById('modal-univ');

    this.bindEvents();
    this.renderPrizeLadder();
  }

  bindEvents() {
    // Sound Toggle
    document.getElementById('btn-sound').addEventListener('click', (e) => {
      const isMuted = sound.toggleMute();
      e.target.textContent = isMuted ? '🔇' : '🔊';
    });

    // Start / Restart Game — o cadastro da Hora da Segurança vem antes da 1ª pergunta
    document.getElementById('btn-screen-action').addEventListener('click', () => {
      sound.playClick();
      HS.exigirCadastro(() => {
        HS.novaPartida();
        this.game.startNewGame();
        this.modalScreen.classList.add('hidden');
        this.updateUI();
      });
    });

    // Quit / Stop Game
    document.getElementById('btn-quit').addEventListener('click', () => {
      sound.playClick();
      if (confirm('Deseja parar o jogo e levar o prêmio acumulado?')) {
        const prize = this.game.stopGame();
        this.showEndScreen('VOCÊ DECIDIU PARAR!', '✋', prize, 'Parou e levou o prêmio');
      }
    });

    // Option Clicks
    this.optionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const optIndex = parseInt(btn.dataset.option);
        if (this.game.selectOption(optIndex)) {
          sound.playClick();
          this.highlightSelectedOption(optIndex);
          this.confirmPanel.classList.remove('hidden');
          // no celular o painel nasce abaixo da dobra: traz ele para a vista
          this.confirmPanel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          sound.playSuspense();
        }
      });
    });

    // Confirm Answer
    document.getElementById('btn-confirm-yes').addEventListener('click', () => {
      const result = this.game.confirmAnswer();
      this.confirmPanel.classList.add('hidden');

      if (!result) return;

      const optBtn = this.optionBtns[result.selectedIndex];

      if (result.status === 'CORRECT') {
        sound.playCorrect();
        if (optBtn) optBtn.classList.add('correct');
        this.hostMessage.textContent = '"CERTA RESPOSTA! Vamos para a próxima pergunta!"';

        setTimeout(() => {
          // intervalo comercial na virada de faixa: perguntas 6, 11 e 16
          if ([5, 10, 15].includes(this.game.currentLevel)) {
            HS.anuncio(() => this.updateUI());
          } else {
            this.updateUI();
          }
        }, 1800);

      } else if (result.status === 'MILLION') {
        sound.playMillionFanfare();
        if (optBtn) optBtn.classList.add('correct');
        setTimeout(() => {
          this.showEndScreen('PARABÉNS! VOCÊ É O MAIS NOVO MILIONÁRIO EM SSMA!', '🏆💰', 1000000, 'Milionário: acertou as 16');
        }, 1500);

      } else if (result.status === 'WRONG') {
        sound.playWrong();
        if (optBtn) optBtn.classList.add('wrong');
        const correctBtn = this.optionBtns[result.correctAnswer];
        if (correctBtn) correctBtn.classList.add('correct');
        this.hostMessage.textContent = '"QUE PENA! Você errou a resposta!"';

        setTimeout(() => {
          this.showEndScreen('QUE PENA! VOCÊ ERROU!', '🚨', result.prize, 'Errou a pergunta');
        }, 2200);
      }
    });

    // Cancel Selection
    document.getElementById('btn-confirm-no').addEventListener('click', () => {
      sound.playClick();
      this.game.selectedOption = null;
      this.confirmPanel.classList.add('hidden');
      this.clearSelectedOptions();
    });

    // Lifeline 1: Skip
    this.btnSkip.addEventListener('click', () => {
      if (this.game.useSkip()) {
        sound.playClick();
        this.hostMessage.textContent = '"Você pulou a pergunta! Vamos para uma nova questão."';
        this.updateUI();
      }
    });

    // Lifeline 2: Cards
    this.btnCards.addEventListener('click', () => {
      if (!this.game.lifelines.cards.available) return;
      sound.playClick();
      this.resetCardsModal();
      this.modalCards.classList.remove('hidden');
    });

    const cardBtns = document.querySelectorAll('.card-btn');
    cardBtns.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        const result = this.game.useCards(idx);
        if (result !== null) {
          sound.playClick();
          btn.classList.add('flipped');
          btn.textContent = result.cardValue === 0 ? 'REI (0)' : `${result.cardValue} CARTA(S)`;

          document.getElementById('cards-result').textContent = 
            result.cardValue === 0 
              ? 'Você tirou o Rei! Nenhuma alternativa foi eliminada.' 
              : `Você eliminou ${result.cardValue} alternativa(s) incorreta(s)!`;

          document.getElementById('btn-close-cards').classList.remove('hidden');
          this.applyEliminatedOptions();
          this.updateLifelineButtons();
        }
      });
    });

    document.getElementById('btn-close-cards').addEventListener('click', () => {
      sound.playClick();
      this.modalCards.classList.add('hidden');
    });

    // Lifeline 3: Placas
    this.btnPlates.addEventListener('click', () => {
      const pcts = this.game.usePlates();
      if (pcts) {
        sound.playClick();
        this.renderPlatesChart(pcts);
        this.modalPlates.classList.remove('hidden');
        this.updateLifelineButtons();
      }
    });

    document.getElementById('btn-close-plates').addEventListener('click', () => {
      sound.playClick();
      this.modalPlates.classList.add('hidden');
    });

    // Lifeline 4: Universitários
    this.btnUniv.addEventListener('click', () => {
      const specs = this.game.useUniv();
      if (specs) {
        sound.playClick();
        this.renderUnivList(specs);
        this.modalUniv.classList.remove('hidden');
        this.updateLifelineButtons();
      }
    });

    document.getElementById('btn-close-univ').addEventListener('click', () => {
      sound.playClick();
      this.modalUniv.classList.add('hidden');
    });
  }

  renderPrizeLadder() {
    this.prizeLadderList.innerHTML = '';
    PRIZE_LADDER.forEach((val, idx) => {
      const li = document.createElement('li');
      li.className = 'prize-item';
      if (idx === 15) li.classList.add('million');

      const formattedVal = val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
      li.innerHTML = `<span>PERGUNTA ${idx + 1}</span><span>${formattedVal}</span>`;
      li.id = `prize-lvl-${idx}`;
      this.prizeLadderList.appendChild(li);
    });
  }

  updateUI() {
    const q = this.game.currentQuestion;
    const levelIndex = this.game.currentLevel;

    // Update Host Message
    const prizes = this.game.getPrizeValues();
    const formattedWin = prizes.win.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    this.hostMessage.textContent = `"Valendo ${formattedWin}! Qual é a resposta certa?"`;

    // Update Question text & metadata
    this.questionNumber.textContent = `PERGUNTA ${levelIndex + 1} DE 16`;
    this.questionCategory.textContent = q.category;
    this.questionText.textContent = q.question;

    // Update Options
    this.clearSelectedOptions();
    q.options.forEach((optText, idx) => {
      const optEl = document.getElementById(`opt-${idx}`);
      optEl.textContent = optText;
    });

    // Update Status Bar
    this.valWin.textContent = prizes.win.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    this.valStop.textContent = prizes.stop.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    this.valLose.textContent = prizes.lose.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

    // Update Prize Ladder Active Highlight
    for (let i = 0; i < 16; i++) {
      const el = document.getElementById(`prize-lvl-${i}`);
      el.classList.remove('active', 'passed');
      if (i < levelIndex) el.classList.add('passed');
      if (i === levelIndex) el.classList.add('active');
    }

    this.updateLifelineButtons();
    this.applyEliminatedOptions();
  }

  highlightSelectedOption(selectedIndex) {
    this.clearSelectedOptions();
    this.optionBtns[selectedIndex].classList.add('selected');
  }

  clearSelectedOptions() {
    this.optionBtns.forEach(btn => {
      btn.classList.remove('selected', 'correct', 'wrong');
    });
  }

  applyEliminatedOptions() {
    this.optionBtns.forEach((btn, idx) => {
      if (this.game.eliminatedOptions.includes(idx)) {
        btn.classList.add('eliminated');
        btn.disabled = true;
      } else {
        btn.classList.remove('eliminated');
        btn.disabled = false;
      }
    });
  }

  updateLifelineButtons() {
    this.btnUniv.disabled = !this.game.lifelines.univ.available;
    this.btnCards.disabled = !this.game.lifelines.cards.available;
    this.btnPlates.disabled = !this.game.lifelines.plates.available;
    this.btnSkip.disabled = this.game.lifelines.skips <= 0;
    this.skipCount.textContent = `${this.game.lifelines.skips} RESTANTES`;
  }

  resetCardsModal() {
    const cardBtns = document.querySelectorAll('.card-btn');
    cardBtns.forEach(btn => {
      btn.classList.remove('flipped');
      btn.textContent = '❓';
    });
    document.getElementById('cards-result').textContent = '';
    document.getElementById('btn-close-cards').classList.add('hidden');
  }

  renderPlatesChart(pcts) {
    const container = document.getElementById('plates-bars');
    container.innerHTML = '';
    const letters = ['A', 'B', 'C', 'D'];

    pcts.forEach((pct, idx) => {
      const row = document.createElement('div');
      row.className = 'plate-row';
      row.innerHTML = `
        <span class="plate-lbl">${letters[idx]}</span>
        <div class="plate-bar-bg">
          <div class="plate-bar-fill" style="width: ${pct}%"></div>
        </div>
        <span class="plate-pct">${pct}%</span>
      `;
      container.appendChild(row);
    });
  }

  renderUnivList(specialists) {
    const container = document.getElementById('univ-list');
    container.innerHTML = '';

    specialists.forEach(spec => {
      const div = document.createElement('div');
      div.className = 'univ-item';
      div.innerHTML = `<strong>${spec.name}:</strong> "Tenho convicção que a resposta correta é a Alternativa <strong>${spec.op}</strong>."`;
      container.appendChild(div);
    });
  }

  showEndScreen(title, icon, finalPrize, resultado) {
    // grava na planilha e mostra o patrocinador antes do resultado
    const acertos = this.game.currentLevel;
    HS.concluir(finalPrize, (resultado || title) + ' · ' + acertos + ' de 16 perguntas');
    HS.anuncio(() => this.renderEndScreen(title, icon, finalPrize));
  }

  renderEndScreen(title, icon, finalPrize) {
    document.getElementById('screen-title').textContent = title;
    document.getElementById('screen-icon').textContent = icon;
    document.getElementById('screen-subtitle').textContent = 'Obrigado por participar do Quiz do Milhão SSMA!';

    const prizeBox = document.getElementById('screen-prize-box');
    const finalVal = document.getElementById('final-prize-val');

    prizeBox.classList.remove('hidden');
    finalVal.textContent = finalPrize.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

    document.getElementById('btn-screen-action').textContent = 'JOGAR NOVAMENTE 🔄';
    this.modalScreen.classList.remove('hidden');
  }
}

// Launch Game on Load
window.addEventListener('DOMContentLoaded', () => {
  new ShowDoMilhaoUI();
});
