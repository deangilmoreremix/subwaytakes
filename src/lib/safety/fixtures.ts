// Test fixtures only: the shows and their sample answers, gathered in one place for the safety test.
import { SHOWS as ALL } from '../shows';
export const SHOWS = ALL;
export const SAMPLE_ANSWERS_FOR_TEST: string[] = ALL.flatMap(s => [s.question, s.answerLabel, s.reaction]);
