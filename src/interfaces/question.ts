enum QuestionType {
  MultiChoice = 'MultiChoice',
  BinaryQuestion = 'BinaryQuestion',
}

interface QuestionOption {
  id: number;
  option: string;
  isCorrect?: boolean;
  calculatedIsCorrect?: boolean | null;
  calculatedAveragePercentage?: number | null;
  calculatedPercentageOfSelectedAnswers?: number | null;
  isLeft: boolean;
  createdAt?: string;
  updatedAt?: string;
  questionId?: number;
}

interface QuestionTag {
  id: number;
  createdAt: string;
  updatedAt: string;
  tagId: number;
  questionId: number;
}

export interface IQuestion {
  id: number;
  question: string;
  durationMiliseconds: number;
  type: QuestionType;
  revealToken?: string;
  revealTokenAmount?: number;
  revealAtDate?: string;
  revealAtAnswerCount?: number | null;
  imageUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
  campaignId?: number | null;
  questionOptions: QuestionOption[];
  deckId?: number;
  questionTags: QuestionTag[] | [];
  deckRevealAtDate?: string;
}
