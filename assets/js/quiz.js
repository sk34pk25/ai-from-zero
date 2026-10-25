/** Correction d'un QCM à réponse unique. */

export function gradeQuiz(answerIndex, choiceIndex) {
  if (!Number.isInteger(choiceIndex) || choiceIndex < 0) {
    return { status: "unanswered", correct: false };
  }
  const correct = choiceIndex === answerIndex;
  return { status: correct ? "correct" : "incorrect", correct };
}
