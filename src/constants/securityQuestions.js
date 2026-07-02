export const SECURITY_QUESTIONS = [
  {
    key: "favorite_book",
    label: "What is your favourite book?",
    placeholder: "Your favourite book",
  },
  {
    key: "mother_maiden_name",
    label: "What is your mother's maiden name?",
    placeholder: "Your mother's maiden name",
  },
  {
    key: "first_pet",
    label: "What was the name of your first pet?",
    placeholder: "Your first pet's name",
  },
  {
    key: "birth_city",
    label: "In what city were you born?",
    placeholder: "Your birth city",
  },
  {
    key: "first_school",
    label: "What was the name of your first school?",
    placeholder: "Your first school",
  },
  {
    key: "childhood_friend",
    label: "What was the name of your childhood best friend?",
    placeholder: "Your childhood best friend's name",
  },
];

export function getSecurityQuestionByKey(questionKey = "") {
  return (
    SECURITY_QUESTIONS.find((question) => question.key === questionKey) ||
    SECURITY_QUESTIONS[0]
  );
}

export function isValidSecurityQuestionKey(questionKey = "") {
  return SECURITY_QUESTIONS.some((question) => question.key === questionKey);
}
