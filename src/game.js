import { QUESTIONS_DATABASE } from './questions.js';

export const PRIZE_LADDER = [
  1000, 2000, 3000, 4000, 5000,
  10000, 20000, 30000, 40000, 50000,
  100000, 200000, 300000, 400000, 500000,
  1000000
];

export class GameEngine {
  constructor() {
    this.currentLevel = 0; // 0 to 15
    this.currentQuestion = null;
    this.eliminatedOptions = []; // Array of indices eliminated by Cards
    this.selectedOption = null;

    // Persistent across matches in the same session to guarantee 3+ full non-repeating rounds!
    this.sessionUsedQuestions = new Set();

    this.lifelines = {
      univ: { available: true },
      cards: { available: true },
      plates: { available: true },
      skips: 3
    };

    this.isGameOver = false;
    this.finalPrize = 0;
  }

  startNewGame() {
    this.currentLevel = 0;
    this.eliminatedOptions = [];
    this.selectedOption = null;
    this.isGameOver = false;
    this.finalPrize = 0;

    this.lifelines = {
      univ: { available: true },
      cards: { available: true },
      plates: { available: true },
      skips: 3
    };

    this.loadQuestionForLevel();
  }

  loadQuestionForLevel() {
    this.eliminatedOptions = [];
    this.selectedOption = null;

    let categoryList;
    if (this.currentLevel < 5) categoryList = QUESTIONS_DATABASE.easy;
    else if (this.currentLevel < 10) categoryList = QUESTIONS_DATABASE.medium;
    else if (this.currentLevel < 15) categoryList = QUESTIONS_DATABASE.hard;
    else categoryList = QUESTIONS_DATABASE.million;

    // Filter available questions not used in session yet
    let unused = categoryList.filter(q => !this.sessionUsedQuestions.has(q.question));

    // If all questions in this category tier were used, reset session tracker for this tier
    if (unused.length === 0) {
      categoryList.forEach(q => this.sessionUsedQuestions.delete(q.question));
      unused = categoryList;
    }

    const randomIndex = Math.floor(Math.random() * unused.length);
    const rawQuestion = unused[randomIndex];
    this.sessionUsedQuestions.add(rawQuestion.question);

    // Shuffle options A, B, C, D randomly every time!
    this.currentQuestion = this.prepareShuffledQuestion(rawQuestion);
  }

  prepareShuffledQuestion(originalQ) {
    const correctText = originalQ.options[originalQ.correct];
    
    // Shuffle options array randomly
    const shuffledOptions = [...originalQ.options].sort(() => Math.random() - 0.5);
    const newCorrectIndex = shuffledOptions.indexOf(correctText);

    return {
      ...originalQ,
      options: shuffledOptions,
      correct: newCorrectIndex
    };
  }

  getPrizeValues() {
    const currentPrize = PRIZE_LADDER[this.currentLevel];
    const prevPrize = this.currentLevel > 0 ? PRIZE_LADDER[this.currentLevel - 1] : 0;

    let losePrize;
    if (this.currentLevel === 15) {
      losePrize = 0;
    } else {
      losePrize = Math.floor(prevPrize / 2);
    }

    return {
      win: currentPrize,
      stop: prevPrize,
      lose: losePrize
    };
  }

  selectOption(optionIndex) {
    if (this.eliminatedOptions.includes(optionIndex)) return false;
    this.selectedOption = optionIndex;
    return true;
  }

  confirmAnswer() {
    if (this.selectedOption === null) return null;

    const selectedIndex = this.selectedOption;
    const isCorrect = (selectedIndex === this.currentQuestion.correct);
    const prizes = this.getPrizeValues();

    if (isCorrect) {
      if (this.currentLevel === 15) { // WIN 1 MILLION!
        this.isGameOver = true;
        this.finalPrize = 1000000;
        return { status: 'MILLION', prize: 1000000, selectedIndex, correctAnswer: this.currentQuestion.correct };
      }
      this.currentLevel++;
      this.loadQuestionForLevel();
      return { status: 'CORRECT', prize: prizes.win, selectedIndex, correctAnswer: this.currentQuestion.correct };
    } else {
      this.isGameOver = true;
      this.finalPrize = prizes.lose;
      return { status: 'WRONG', prize: prizes.lose, selectedIndex, correctAnswer: this.currentQuestion.correct };
    }
  }

  stopGame() {
    this.isGameOver = true;
    const prizes = this.getPrizeValues();
    this.finalPrize = prizes.stop;
    return prizes.stop;
  }

  useSkip() {
    if (this.lifelines.skips <= 0) return false;
    this.lifelines.skips--;
    this.loadQuestionForLevel();
    return true;
  }

  useCards(cardIndex) {
    if (!this.lifelines.cards.available) return null;
    this.lifelines.cards.available = false;

    // Card values: 0 (Rei - zero eliminations), 1 (Ás - 1), 2 (2 - 2), 3 (3 - 3 eliminations)
    const cardValues = [0, 1, 2, 3];
    const shuffleCards = [...cardValues].sort(() => Math.random() - 0.5);
    const numToEliminate = shuffleCards[cardIndex];

    const wrongOptions = [0, 1, 2, 3].filter(idx => idx !== this.currentQuestion.correct);
    const shuffleWrong = [...wrongOptions].sort(() => Math.random() - 0.5);

    const newlyEliminated = shuffleWrong.slice(0, numToEliminate);
    this.eliminatedOptions.push(...newlyEliminated);

    return {
      cardValue: numToEliminate,
      eliminated: newlyEliminated
    };
  }

  usePlates() {
    if (!this.lifelines.plates.available) return null;
    this.lifelines.plates.available = false;

    const correctIndex = this.currentQuestion.correct;
    const percentages = [0, 0, 0, 0];

    const correctPct = Math.floor(Math.random() * 30) + 55;
    percentages[correctIndex] = correctPct;

    let remaining = 100 - correctPct;
    const wrongIndices = [0, 1, 2, 3].filter(i => i !== correctIndex);

    for (let i = 0; i < wrongIndices.length - 1; i++) {
      const idx = wrongIndices[i];
      const p = Math.floor(Math.random() * (remaining * 0.7));
      percentages[idx] = p;
      remaining -= p;
    }
    percentages[wrongIndices[wrongIndices.length - 1]] = remaining;

    return percentages;
  }

  useUniv() {
    if (!this.lifelines.univ.available) return null;
    this.lifelines.univ.available = false;

    const correctLetter = ['A', 'B', 'C', 'D'][this.currentQuestion.correct];
    const letters = ['A', 'B', 'C', 'D'];

    const specialists = [
      { name: "Eng.ª Amanda (Segurança)", op: Math.random() < 0.85 ? correctLetter : letters[Math.floor(Math.random() * 4)] },
      { name: "Dr. Carlos (Médico do Trabalho)", op: Math.random() < 0.80 ? correctLetter : letters[Math.floor(Math.random() * 4)] },
      { name: "Tec. Marcos (Perito Ambiental)", op: Math.random() < 0.90 ? correctLetter : letters[Math.floor(Math.random() * 4)] }
    ];

    return specialists;
  }
}
