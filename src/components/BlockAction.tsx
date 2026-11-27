import { Link } from 'react-router-dom';
import { openKeyModal } from '../lib/muapi/key';

/** The one-click fix next to a "you cannot generate yet" message: sign up, or add your muapi key. */
export function BlockAction({ block }: { block: 'guest' | 'unverified' | 'nokey' | null }) {
  if (block === 'guest') return <Link to="/login" className="underline">Sign up or sign in</Link>;
  if (block === 'nokey') return <button onClick={() => openKeyModal()} className="font-semibold underline" data-testid="block-add-key">Add key</button>;
  return null;
}
