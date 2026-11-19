import { guestWordBudget, isComposedShow, type TakeSpec } from '../interview';
import { composeSpokenLine, type Composed } from './index';
import { composeQuoteLine, type ComposedQuote } from '../quotes';

/**
 * Scripture and Motivation-with-a-quote episodes: what the guest says is the verse or quote (if it fits the clip) plus their own comment. This keeps `take`
 * (the spoken line) in step with the pick, the comment and the clip length. Everything else is returned untouched. Pure.
 */
export function recomposeBible<T extends TakeSpec>(spec: T): T {
  if (spec.show === 'bible') {
    const reflection = spec.reflection ?? spec.take;
    return { ...spec, reflection, take: composeSpokenLine(spec.verse, reflection, guestWordBudget(spec)).line };
  }
  if (spec.show === 'motivation' && spec.quote) {
    const reflection = spec.reflection ?? '';
    return { ...spec, reflection, take: composeQuoteLine(spec.quote, reflection, guestWordBudget(spec)).line };
  }
  return spec;
}

/** The same composition, for showing the customer whether the verse will be spoken in full. */
export function bibleComposition(spec: TakeSpec): Composed {
  return composeSpokenLine(spec.verse, spec.reflection ?? spec.take, guestWordBudget(spec));
}
export function quoteComposition(spec: TakeSpec): ComposedQuote {
  return composeQuoteLine(spec.quote, spec.reflection ?? '', guestWordBudget(spec));
}

/** The spoken line is COMPOSED from a verse or quote plus the guest's own words, so typing into the prompt bar or the take box must change the guest's own words, not the composed line. */
export const isComposed = (spec: TakeSpec): boolean => isComposedShow(spec);
/** Which field the customer's typing goes to. */
export const editableField = (spec: TakeSpec): 'reflection' | 'take' => (isComposed(spec) ? 'reflection' : 'take');
/** What the prompt bar shows for editing: the guest's own words for composed shows, the take otherwise. */
export const editableText = (spec: TakeSpec): string => (isComposed(spec) ? spec.reflection ?? '' : spec.take);
/** Apply a typed edit and keep the composed spoken line in step. */
export function applyTakeEdit<T extends TakeSpec>(spec: T, text: string): T {
  return recomposeBible({ ...spec, [editableField(spec)]: text.slice(0, 220) });
}
