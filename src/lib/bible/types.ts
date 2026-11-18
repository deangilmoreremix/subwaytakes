/** The verse a Scripture episode puts on screen. `library` verses come from the verified public-domain list; `typed` ones are the customer's own text. */
export interface PickedVerse {
  ref: string;
  translation: 'KJV' | 'WEB' | 'BSB' | 'custom';
  text: string;
  source: 'library' | 'typed';
}
