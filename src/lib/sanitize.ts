import DOMPurify from 'dompurify';

/**
 * Sanitization utility for user inputs
 * Prevents XSS attacks by sanitizing all user-provided content
 */

// Configure DOMPurify for strict sanitization
const purifyConfig = {
  ALLOWED_TAGS: [], // No HTML tags allowed - plain text only
  ALLOWED_ATTR: [], // No attributes allowed
  KEEP_CONTENT: true,
};

/**
 * Sanitize user input to prevent XSS
 * Removes all HTML tags and returns plain text
 */
export function sanitizeInput(input: string | null | undefined): string {
  if (!input) return '';
  
  // First, sanitize to remove any HTML/script tags
  const sanitized = DOMPurify.sanitize(input, purifyConfig);
  
  return sanitized;
}

/**
 * Sanitize input but preserve basic formatting (for display purposes)
 * Allows newlines to be preserved
 */
export function sanitizeInputPreserveFormatting(input: string | null | undefined): string {
  if (!input) return '';

  const placeholder = '\x00NL\x00';
  const withPlaceholder = input.replace(/\n/g, placeholder);
  const sanitized = DOMPurify.sanitize(withPlaceholder, purifyConfig);

  return sanitized.replace(new RegExp(placeholder, 'g'), '\n');
}

/**
 * Validate and sanitize interview questions
 */
export function sanitizeInterviewQuestion(question: string | null | undefined): string {
  const sanitized = sanitizeInput(question);
  // Limit to 500 characters
  return sanitized.slice(0, 500);
}

/**
 * Validate and sanitize angle prompts
 */
export function sanitizeAnglePrompt(prompt: string | null | undefined): string {
  const sanitized = sanitizeInput(prompt);
  // Limit to 1000 characters
  return sanitized.slice(0, 1000);
}

/**
 * Validate and sanitize speech scripts
 */
export function sanitizeSpeechScript(script: string | null | undefined): string {
  const sanitized = sanitizeInputPreserveFormatting(script);
  // Limit to 2000 characters
  return sanitized.slice(0, 2000);
}

/**
 * Validate and sanitize topic inputs
 */
export function sanitizeTopicInput(topic: string | null | undefined): string {
  const sanitized = sanitizeInput(topic);
  // Limit to 200 characters
  return sanitized.slice(0, 200);
}

/**
 * Check if input contains potentially dangerous content
 */
export function containsDangerousContent(input: string | null | undefined): boolean {
  if (!input) return false;
  
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
  ];

  return dangerousPatterns.some(pattern => pattern.test(input));
}
