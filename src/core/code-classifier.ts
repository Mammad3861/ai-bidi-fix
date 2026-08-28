const PERSIAN_ARABIC_CHARACTER = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/u;
const PERSIAN_ARABIC_WORD = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]{2,}/gu;
const PERSIAN_ARABIC_SENTENCE_WORDS =
  /(?:[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]{2,}[\s،؛,.!?]+){3,}/u;
const SOURCE_KEYWORD =
  /\b(?:import|export|function|class|const|let|var|return|throw|if|else|for|while|switch|case|try|catch|interface|type|enum|async|await|def|from|public|private|protected|static|new|extends|implements)\b/g;
const SOURCE_LINE =
  /^\s*(?:import|export|function|class|const|let|var|return|throw|if|else|for|while|switch|case|try|catch|interface|type|enum|async|await|def|from|public|private|protected|static)\b/;
const SHELL_COMMAND_LINE =
  /^\s*(?:[$>]\s*)?(?:npm|pnpm|yarn|node|npx|git|cd|mkdir|rm|cp|mv|python|pip|curl|docker|deno|bun|echo|printf)(?:\s+(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[\w./:@=+,-]+))+\s*$/i;
const SHELL_COMMENT_LINE = /^\s*#/;
const HTML_DOCUMENT =
  /^\s*(?:<!doctype\s+html[^>]*>\s*)?<([A-Za-z][\w:-]*)\b[^>]*>[\s\S]*<\/\1>\s*$/i;
const HTML_SELF_CLOSING = /^\s*<[A-Za-z][\w:-]*\b[^>]*\/?>\s*$/;
const CSS_RULE_BLOCK = /(?:^|\n)\s*[^{}\n]+\{[\s\S]*\b[a-z-]+\s*:\s*[^;{}]+;[\s\S]*\}\s*$/i;
const CSS_DECLARATION_LINE = /^\s*[a-z-]+\s*:\s*[^;{}\n]+;\s*$/i;
const CONFIG_ASSIGNMENT_LINE = /^\s*[A-Za-z0-9_.-]+\s*=\s*\S.*$/;
const YAML_KEY_LINE = /^\s*[A-Za-z_][A-Za-z0-9_-]*\s*:\s*\S.*$/;
const CONFIG_SECTION = /^\s*\[[A-Za-z0-9_.-]+]\s*$/;
const COMPLETE_VARIABLE_STATEMENT =
  /^\s*(?:const|let|var)\s+[\p{L}_$][\p{L}\p{N}_$]*\s*=\s*[\s\S]+;\s*$/u;
const COMPLETE_RETURN_STATEMENT = /^\s*(?:return|throw)\b[\s\S]*;\s*$/;
const COMPLETE_CALL_STATEMENT =
  /^\s*[\p{L}_$][\p{L}\p{N}_$]*(?:\.[\p{L}_$][\p{L}\p{N}_$]*)*\s*\([\s\S]*\)\s*;\s*$/u;
const COMMENTS_AND_STRINGS =
  /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g;

export interface CodeTextClassificationOptions {
  inlineCode?: boolean;
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function nonEmptyLines(text: string): string[] {
  return text.split(/\r?\n/).filter((line) => line.trim().length > 0);
}

function hasBalancedPair(text: string, opening: string, closing: string): boolean {
  let openingCount = 0;
  let closingCount = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === opening) openingCount += 1;
    else if (text[index] === closing) closingCount += 1;
  }
  return openingCount > 0 && openingCount === closingCount;
}

function isStructuredJsonBlock(text: string): boolean {
  const skeleton = text.replace(COMMENTS_AND_STRINGS, (match) => ' '.repeat(match.length));
  if (PERSIAN_ARABIC_CHARACTER.test(skeleton)) return false;
  if (/^\{[\s\S]*\}$/.test(text)) {
    return hasBalancedPair(skeleton, '{', '}') && /"(?:\\.|[^"\\])*"\s*:/.test(text);
  }
  return /^\[[\s\S]*]$/.test(text) && hasBalancedPair(skeleton, '[', ']');
}

function isShellOnlyBlock(lines: string[]): boolean {
  let commandCount = 0;
  for (const line of lines) {
    if (SHELL_COMMENT_LINE.test(line)) continue;
    if (!SHELL_COMMAND_LINE.test(line)) return false;
    commandCount += 1;
  }
  return commandCount > 0;
}

function isStructuredSourceBlock(text: string, lines: string[]): boolean {
  const skeleton = text.replace(COMMENTS_AND_STRINGS, (match) => ' '.repeat(match.length));
  const skeletonLines = nonEmptyLines(skeleton);
  const sourceLineCount = skeletonLines.filter((line) => SOURCE_LINE.test(line)).length;
  const indentedLineCount = skeletonLines.filter((line) => /^\s{2,}|\t/.test(line)).length;
  const keywordCount = countMatches(skeleton, SOURCE_KEYWORD);
  const punctuationCount = countMatches(skeleton, /[{}[\]();=<>|&]/g);
  const balancedBraces = hasBalancedPair(skeleton, '{', '}');

  if (COMPLETE_VARIABLE_STATEMENT.test(skeleton)) return true;
  if (COMPLETE_RETURN_STATEMENT.test(skeleton)) return true;
  if (COMPLETE_CALL_STATEMENT.test(skeleton)) return true;
  if (/\b(?:function|class)\b[\s\S]*\{[\s\S]*\}/.test(skeleton) && balancedBraces) {
    return true;
  }
  if (
    sourceLineCount >= 2 &&
    keywordCount >= 2 &&
    (punctuationCount >= 2 || indentedLineCount >= 1)
  ) {
    return true;
  }
  if (lines.length >= 3 && keywordCount >= 2 && balancedBraces && punctuationCount >= 4) {
    return true;
  }
  return false;
}

function isStructuredStyleOrConfigBlock(text: string, lines: string[]): boolean {
  if (CSS_RULE_BLOCK.test(text)) return true;
  if (lines.length > 0 && lines.every((line) => CSS_DECLARATION_LINE.test(line))) return true;

  const configLineCount = lines.filter(
    (line) =>
      CONFIG_ASSIGNMENT_LINE.test(line) || YAML_KEY_LINE.test(line) || CONFIG_SECTION.test(line),
  ).length;
  return lines.length >= 2 && configLineCount === lines.length;
}

function hasStrongCodeStructure(text: string, lines: string[]): boolean {
  return (
    isStructuredJsonBlock(text) ||
    isShellOnlyBlock(lines) ||
    HTML_DOCUMENT.test(text) ||
    HTML_SELF_CLOSING.test(text) ||
    isStructuredSourceBlock(text, lines) ||
    isStructuredStyleOrConfigBlock(text, lines)
  );
}

export function isLikelyRealCodeText(
  text: string,
  options: CodeTextClassificationOptions = {},
): boolean {
  const normalized = text.trim();
  if (!normalized) return false;

  const lines = nonEmptyLines(normalized);
  if (hasStrongCodeStructure(normalized, lines)) return true;

  const hasRtl = PERSIAN_ARABIC_CHARACTER.test(normalized);
  if (options.inlineCode && !hasRtl) return true;

  const rtlWordCount = countMatches(normalized, PERSIAN_ARABIC_WORD);
  const charCount = Math.max(normalized.replace(/\s/g, '').length, 1);
  const codePunctuationCount = countMatches(normalized, /[{}[\]();=<>|&]/g);
  const punctuationDensity = codePunctuationCount / charCount;
  const keywordCount = countMatches(normalized, SOURCE_KEYWORD);
  const shellLikeLineCount = lines.filter((line) => SHELL_COMMAND_LINE.test(line)).length;
  let codeScore = Math.min(keywordCount * 2, 6) + Math.min(shellLikeLineCount * 2, 4);
  let proseScore = 0;

  if (punctuationDensity > 0.08) codeScore += 2;
  if (punctuationDensity > 0.14) codeScore += 2;
  if (lines.length >= 3 && lines.filter((line) => /^\s{2,}|\t/.test(line)).length >= 2) {
    codeScore += 2;
  }

  if (hasRtl) proseScore += 3;
  if (rtlWordCount >= 2) proseScore += 3;
  if (rtlWordCount >= 4) proseScore += 2;
  if (rtlWordCount >= 8) proseScore += 2;
  if (PERSIAN_ARABIC_SENTENCE_WORDS.test(normalized)) proseScore += 4;
  if (/[،؛؟]/u.test(normalized)) proseScore += 2;
  if (hasRtl && punctuationDensity < 0.08) proseScore += 1;

  return codeScore >= proseScore + 2;
}
