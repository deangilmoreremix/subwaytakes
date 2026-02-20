import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, MapPin, Clock, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { CITY_STYLES } from '../lib/constants';
import { clsx } from '../lib/format';

export function SettingsPage() {
  const navigate = useNavigate();
  const { profile, updateProfile, user, isGuest } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [defaultCity, setDefaultCity] = useState('nyc');
  const [defaultDuration, setDefaultDuration] = useState(6);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '');
      setDefaultCity(profile.default_city_style || 'nyc');
      setDefaultDuration(profile.default_duration || 6);
    }
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const { error } = await updateProfile({
      display_name: displayName || null,
      default_city_style: defaultCity,
      default_duration: defaultDuration,
    } as any);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  const tierColors: Record<string, string> = {
    free: 'bg-zinc-500/20 text-zinc-300 border-zinc-700',
    pro: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    enterprise: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <h1 className="text-2xl font-semibold text-zinc-100 mb-8">Settings</h1>

      <div className="space-y-8">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <User className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Profile</h2>
              <p className="text-sm text-zinc-500">{isGuest ? 'Guest Mode' : user?.email}</p>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Subscription</label>
              <div className="flex items-center gap-3">
                <span className={clsx(
                  'px-3 py-1.5 rounded-lg text-sm font-medium border capitalize',
                  tierColors[profile?.subscription_tier || 'free'] || tierColors.free
                )}>
                  {profile?.subscription_tier || 'Free'}
                </span>
                <span className="text-sm text-zinc-500">
                  {profile?.credits_balance ?? 0} credits remaining
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-100">Default Preferences</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Default City Style</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {CITY_STYLES.map(city => (
                  <button
                    key={city.value}
                    onClick={() => setDefaultCity(city.value)}
                    className={clsx(
                      'px-3 py-2 rounded-xl text-sm font-medium border transition',
                      defaultCity === city.value
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    )}
                  >
                    {city.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  Default Duration
                </div>
              </label>
              <div className="flex gap-2">
                {[3, 4, 5, 6, 8].map(d => (
                  <button
                    key={d}
                    onClick={() => setDefaultDuration(d)}
                    className={clsx(
                      'px-4 py-2 rounded-xl text-sm font-medium border transition',
                      defaultDuration === d
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    )}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          {saved && (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Saved
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-zinc-900 font-semibold hover:bg-amber-400 disabled:opacity-50 transition"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
