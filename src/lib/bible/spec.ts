import { guestWordBudget, type TakeSpec } from '../interview';
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
