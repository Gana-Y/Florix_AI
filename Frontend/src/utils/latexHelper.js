/**
 * Utility to normalize LaTeX equations for remark-math and KaTeX.
 * Handles common LLM output quirks:
 * 1. Converts \[ ... \] to $$ ... $$
 * 2. Converts \( ... \) to $ ... $
 * 3. Prepends missing opening $$ before common LaTeX math commands if followed by closing $$
 * 4. Ensures proper newlines around display math blocks
 */
export const preprocessLatex = (content) => {
  if (!content || typeof content !== 'string') return '';
  let text = content;

  // 1. Escape currency dollars (e.g. $50, $10.99, $40,000) so remark-math does not mistake them for LaTeX
  text = text.replace(/(?<![\$\\])\$(?=\d)/g, () => '\\$');

  // 2. Convert standard LaTeX block delimiters \[ ... \] to $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => `\n\n$$\n${equation.trim()}\n$$\n\n`);

  // 3. Convert standard LaTeX inline delimiters \( ... \) to $ ... $
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, equation) => `$${equation.trim()}$`);

  // 4. Convert snake_case identifiers wrapped in $ (e.g. $user_id$, $data_set$) to inline code backticks
  // In LaTeX, unescaped underscores cause broken subscript parse errors.
  text = text.replace(/(?<![\$\\])\$([a-zA-Z0-9]+_[a-zA-Z0-9_]+)\$(?![\$])/g, '`$1`');

  // 5. Fix missing opening $$ when an equation starts with a LaTeX command and ends with $$
  // Matches e.g. "\frac{1}{N} \sum_{i=1}^{N} L(y_i, f(x_i))$$"
  text = text.replace(/(^|\n|[^\$])(\\(?:frac|sum|int|prod|lim|sqrt|mathbf|mathcal|begin|alpha|beta|gamma|delta|epsilon|sigma|mu|theta|lambda|pi)[\s\S]*?)\$\$/gm, (match, prefix, math) => {
    if (math.startsWith('$')) return match;
    return `${prefix}\n\n$$\n${math.trim()}\n$$\n\n`;
  });

  return text;
};
