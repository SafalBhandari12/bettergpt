import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

// Stable references so react-markdown doesn't treat every render as a new
// plugin pipeline.
const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeHighlight];

interface MarkdownProps {
  content: string;
  /**
   * Force `prose-invert` regardless of site theme. Use for content sitting on
   * a fixed-color background (e.g. a colored chat bubble) that doesn't track
   * light/dark mode itself — `dark:prose-invert` alone would fight the
   * bubble's own colors and produce unreadable text.
   */
  invert?: boolean;
}

function MarkdownImpl({ content, invert = false }: MarkdownProps) {
  const theme = invert ? "prose-invert" : "prose-zinc dark:prose-invert";
  return (
    <div className={`prose prose-sm max-w-none break-words ${theme} prose-pre:bg-transparent prose-pre:p-0`}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Skip re-parsing markdown for messages whose content/invert props didn't
// change — otherwise every mounted bubble re-parses on every streamed token
// just because a sibling's content grew.
export const Markdown = memo(MarkdownImpl);
