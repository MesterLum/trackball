import es from './es.json' with { type: 'json' };
export type Language = 'en' | 'es';
let language: Language = 'en';
export function setLanguage(value: Language) {
  language = value;
}
export function _(message: string, locale: Language = language): string {
  return locale === 'es' ? (es as Record<string, string>)[message] || message : message;
}
