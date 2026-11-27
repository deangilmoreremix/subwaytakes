import { supabase } from '../supabase';
import { uploadMedia } from '../storage';
import { logoProblem, validateBrand, type BrandKit } from './model';

export * from './model';

// ---- server

interface Row { handle: string; primary_color: string; accent_color: string; logo_url: string | null; sponsor_text: string; show_watermark: boolean }
const fromRow = (r: Row): BrandKit => ({ handle: r.handle, primaryColor: r.primary_color, accentColor: r.accent_color, logoUrl: r.logo_url, sponsorText: r.sponsor_text, showWatermark: r.show_watermark });

export async function loadBrandKit(): Promise<BrandKit | null> {
  const { data, error } = await supabase.from('brand_kits').select('handle, primary_color, accent_color, logo_url, sponsor_text, show_watermark').maybeSingle();
  if (error) throw new Error('Could not load your brand kit.');
  return data ? fromRow(data as Row) : null;
}

export async function saveBrandKit(kit: BrandKit): Promise<void> {
  const problems = validateBrand(kit);
  if (problems.length) throw new Error(problems[0]);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to save your brand kit.');
  const { error } = await supabase.from('brand_kits').upsert({
    user_id: user.id, handle: kit.handle.trim(), primary_color: kit.primaryColor, accent_color: kit.accentColor, logo_url: kit.logoUrl,
    sponsor_text: kit.sponsorText.trim(), show_watermark: kit.showWatermark, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error('Could not save your brand kit.');
}

export async function uploadLogo(file: File): Promise<string> {
  const problem = logoProblem(file);
  if (problem) throw new Error(problem);
  return uploadMedia(file, `logo-${file.name}`);
}
