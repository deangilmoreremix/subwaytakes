import { whoosh, whip, ding, vineBoom, recordScratch, shutterModern, mouseClick, uiSwitch, pageTurn, dramaticBoomer, bruh, wilhelmScream, yippee, loadingLag } from '@remotion/sfx';

export interface Sfx { id: string; label: string; url: string }

/** Free sound effects from @remotion/sfx (hosted on remotion.media, CORS-enabled). */
export const SFX: Sfx[] = [
  { id: 'whoosh', label: 'Whoosh', url: whoosh },
  { id: 'whip', label: 'Whip', url: whip },
  { id: 'ding', label: 'Ding', url: ding },
  { id: 'vine-boom', label: 'Vine boom', url: vineBoom },
  { id: 'record-scratch', label: 'Record scratch', url: recordScratch },
  { id: 'dramatic-boomer', label: 'Dramatic hit', url: dramaticBoomer },
  { id: 'shutter', label: 'Camera shutter', url: shutterModern },
  { id: 'click', label: 'Click', url: mouseClick },
  { id: 'switch', label: 'Switch', url: uiSwitch },
  { id: 'page-turn', label: 'Page turn', url: pageTurn },
  { id: 'bruh', label: 'Bruh', url: bruh },
  { id: 'wilhelm', label: 'Wilhelm scream', url: wilhelmScream },
  { id: 'yippee', label: 'Yippee', url: yippee },
  { id: 'loading-lag', label: 'Loading lag', url: loadingLag },
];
