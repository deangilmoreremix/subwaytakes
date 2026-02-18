import type { VideoTemplate } from '../lib/templates';

interface TemplatePreviewCardProps {
  template: VideoTemplate;
  compact?: boolean;
}

export function TemplatePreviewCard({ template, compact = false }: TemplatePreviewCardProps) {
  const height = compact ? 160 : 220;
  const scale = compact ? 0.55 : 0.75;

  const isLeft = template.watermark_position.includes('left');
  const isTop = template.watermark_position.includes('top');

  return (
    <div
      className="relative overflow-hidden bg-zinc-950"
      style={{ height, aspectRatio: compact ? undefined : '9/16' }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, #27272a 0%, #3f3f46 30%, #52525b 50%, #3f3f46 70%, #27272a 100%)',
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            repeating-linear-gradient(
              90deg,
              transparent 0px,
              transparent 40px,
              rgba(161,161,170,0.08) 40px,
              rgba(161,161,170,0.08) 41px
            ),
            repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 25px,
              rgba(161,161,170,0.06) 25px,
              rgba(161,161,170,0.06) 26px
            )
          `,
        }}
      />

      <div className="absolute top-[30%] left-[15%] w-[25%] h-[35%] rounded-lg bg-zinc-600/30" />
      <div className="absolute top-[28%] right-[12%] w-[28%] h-[38%] rounded-lg bg-zinc-500/25" />

      <div
        className="absolute flex items-center gap-1"
        style={{
          [isTop ? 'top' : 'bottom']: 12 * scale,
          [isLeft ? 'left' : 'right']: 10 * scale,
          opacity: template.watermark_opacity,
        }}
      >
        {template.logo_enabled && (
          <span style={{ fontSize: 10 * scale }}>🚇</span>
        )}
        <span
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: template.watermark_font_size * scale,
            fontWeight: 600,
            color: template.watermark_color,
            textShadow: '0 1px 3px rgba(0,0,0,0.6)',
          }}
        >
          {template.watermark_text}
        </span>
      </div>

      <div
        className="absolute left-0 right-0 px-3"
        style={{
          [template.caption_position === 'top' ? 'top' : 'bottom']:
            template.caption_position === 'center' ? '40%' : 20 * scale,
        }}
      >
        <div
          className="rounded-lg px-3 py-2"
          style={{
            backgroundColor: `rgba(0,0,0,${template.caption_bg_opacity})`,
            backdropFilter: 'blur(6px)',
          }}
        >
          <p
            style={{
              fontFamily: `${template.caption_font}, system-ui`,
              fontSize: template.caption_font_size * scale * 0.65,
              fontWeight: 700,
              color: template.caption_color,
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {template.watermark_text} Episode 1: Sample question text here
          </p>
        </div>
      </div>

      {template.reaction_text_enabled && (
        <div
          className="absolute"
          style={{
            bottom: 55 * scale,
            right: template.reaction_text_position.includes('right')
              ? 10 * scale
              : undefined,
            left: template.reaction_text_position.includes('left')
              ? 10 * scale
              : undefined,
          }}
        >
          <span
            style={{
              fontFamily: `${template.caption_font}, system-ui`,
              fontSize: template.reaction_text_font_size * scale * 0.65,
              fontWeight: 700,
              color: template.caption_color,
              textShadow: '0 1px 4px rgba(0,0,0,0.7)',
            }}
          >
            100% agree.
          </span>
        </div>
      )}

      {template.progress_bar_enabled && (
        <div
          className="absolute top-0 left-0 right-0"
          style={{ height: 2 }}
        >
          <div
            style={{
              width: '60%',
              height: '100%',
              backgroundColor: template.progress_bar_color,
              borderRadius: '0 1px 1px 0',
            }}
          />
        </div>
      )}
    </div>
  );
}
