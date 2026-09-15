const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

/** Render text with any http(s) URLs turned into links that open in a new tab. */
export function Linkified({ text, lang }: { text: string; lang?: string }) {
  const parts = text.split(URL_RE);
  return (
    <span lang={lang} className="whitespace-pre-line break-words">
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all font-medium text-accent-strong underline"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}
