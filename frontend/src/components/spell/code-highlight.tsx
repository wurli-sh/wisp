import { cn } from "@/lib/cn";

const SNIPPET_CLASS = "text-sm leading-relaxed";

const TS_KEYWORDS = new Set([
  "import",
  "from",
  "const",
  "let",
  "await",
  "async",
  "new",
  "return",
  "true",
  "false",
]);

type Token = { type: "keyword" | "string" | "type" | "method" | "plain" | "punct" | "space"; value: string };

function tokenizeTsLine(line: string): Token[] {
  const tokens: Token[] = [];
  const re =
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\s+|[A-Za-z_][\w]*|[{}(),.:;=])/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(line)) !== null) {
    const value = match[0];
    if (/^\s+$/.test(value)) {
      tokens.push({ type: "space", value });
    } else if (/^["']/.test(value)) {
      tokens.push({ type: "string", value });
    } else if (TS_KEYWORDS.has(value)) {
      tokens.push({ type: "keyword", value });
    } else if (/^[A-Z]/.test(value)) {
      tokens.push({ type: "type", value });
    } else if (value === "." || /^\.[A-Za-z]/.test(value)) {
      tokens.push({ type: "punct", value });
    } else if (/^[a-z_][\w]*$/.test(value) && tokens.at(-1)?.value === ".") {
      tokens.push({ type: "method", value });
    } else if (/^[{}(),.:;=]$/.test(value)) {
      tokens.push({ type: "punct", value });
    } else {
      tokens.push({ type: "plain", value });
    }
  }

  return tokens;
}

const tokenClass: Record<Token["type"], string> = {
  keyword: "text-primary-soft",
  string: "text-code-command-accent",
  type: "text-code-type",
  method: "text-code-plain",
  plain: "text-code-plain",
  punct: "text-code-punct",
  space: "",
};

function TokenSpan({ token }: { token: Token }) {
  return <span className={tokenClass[token.type]}>{token.value}</span>;
}

export function TypeScriptSnippet({ code }: { code: string }) {
  const lines = code.split("\n");

  return (
    <pre
      className={cn(
        "m-0 flex-1 overflow-x-auto whitespace-pre bg-transparent p-0 text-left",
        SNIPPET_CLASS,
      )}
    >
      {lines.map((line, i) => (
        <div key={i}>
          {tokenizeTsLine(line).map((token, j) => (
            <TokenSpan key={j} token={token} />
          ))}
          {line.length === 0 && "\u00A0"}
        </div>
      ))}
    </pre>
  );
}

export function InstallCommand({ command }: { command: string }) {
  const match = command.match(/^(pnpm|npm|yarn|bun)\s+(add|install)\s+(\S+)$/);

  if (!match) {
    return <span className={cn(SNIPPET_CLASS, "text-code-plain")}>{command}</span>;
  }

  const [, pm, verb, pkg] = match;

  return (
    <p className={cn("flex-1 text-left", SNIPPET_CLASS)}>
      <span className="text-code-punct">$ </span>
      <span className="text-code-command">{pm}</span>
      <span className="text-code-punct"> </span>
      <span className="text-code-type">{verb}</span>
      <span className="text-code-punct"> </span>
      <span className="text-code-command-accent">{pkg}</span>
    </p>
  );
}
