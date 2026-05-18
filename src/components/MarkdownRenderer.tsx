import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'

export default function MarkdownRenderer({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkBreaks]}>{children}</ReactMarkdown>
}
