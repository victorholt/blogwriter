import { DEFAULT_INSTRUCTIONS as brandVoiceAnalyzer } from '../agents/brand-voice-analyzer';
import { DEFAULT_INSTRUCTIONS as blogEditor } from '../agents/blog-editor';
import { DEFAULT_INSTRUCTIONS as seoSpecialist } from '../agents/seo-specialist';
import { DEFAULT_INSTRUCTIONS as seniorEditor } from '../agents/senior-editor';
import { DEFAULT_INSTRUCTIONS as blogReviewer } from '../agents/blog-reviewer';
import { DEFAULT_INSTRUCTIONS as textEnhancer } from '../agents/text-enhancer';
import { DEFAULT_INSTRUCTIONS as brandVoiceFast } from '../agents/brand-voice-fast';
import { DEFAULT_INSTRUCTIONS as brandVoiceFormatter } from '../agents/brand-voice-formatter';
import { BLOG_WRITER_TEMPLATE as blogWriter } from '../agents/blog-writer';

export interface AgentDefault {
  instructions: string;
  isDynamic: boolean;
}

export const AGENT_DEFAULTS: Record<string, AgentDefault> = {
  'brand-voice-analyzer': { instructions: brandVoiceAnalyzer, isDynamic: false },
  'blog-writer': { instructions: blogWriter, isDynamic: true },
  'blog-editor': { instructions: blogEditor, isDynamic: false },
  'seo-specialist': { instructions: seoSpecialist, isDynamic: false },
  'senior-editor': { instructions: seniorEditor, isDynamic: false },
  'blog-reviewer': { instructions: blogReviewer, isDynamic: false },
  'text-enhancer': { instructions: textEnhancer, isDynamic: false },
  'brand-voice-fast': { instructions: brandVoiceFast, isDynamic: false },
  'brand-voice-formatter': { instructions: brandVoiceFormatter, isDynamic: false },
};
