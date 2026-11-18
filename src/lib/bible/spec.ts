import { guestWordBudget, type TakeSpec } from '../interview';
import { composeSpokenLine, type Composed } from './index';

/**
 * Scripture episodes: what the guest says is the verse (if it fits the clip) plus their reflection. This keeps `take` (the spoken line) in step
 * with the picked verse, the reflection and the clip length. Other shows are returned untouched. Pure.
 */
export function recomposeBible<T extends TakeSpec>(spec: T): T {
  if (spec.show !== 'bible') return spec;
  const reflection = spec.reflection ?? spec.take;
  return { ...spec, reflection, take: composeSpokenLine(spec.verse, reflection, guestWordBudget(spec)).line };
}

/** The same composition, for showing the customer whether the verse will be spoken in full. */
export function bibleComposition(spec: TakeSpec): Composed {
  return composeSpokenLine(spec.verse, spec.reflection ?? spec.take, guestWordBudget(spec));
}
