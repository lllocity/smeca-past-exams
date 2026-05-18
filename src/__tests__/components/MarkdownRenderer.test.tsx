import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MarkdownRenderer from '@/components/MarkdownRenderer'

describe('MarkdownRenderer', () => {
  it('単一改行を <br> としてレンダリングする', () => {
    const { container } = render(<MarkdownRenderer>{'行A\n行B'}</MarkdownRenderer>)
    expect(container.querySelector('br')).not.toBeNull()
  })

  it('Markdown の太字を <strong> としてレンダリングする', () => {
    const { container } = render(<MarkdownRenderer>{'**太字**'}</MarkdownRenderer>)
    expect(container.querySelector('strong')).not.toBeNull()
  })

  it('通常テキストをそのままレンダリングする', () => {
    const { getByText } = render(<MarkdownRenderer>{'シンプルなテキスト'}</MarkdownRenderer>)
    expect(getByText('シンプルなテキスト')).not.toBeNull()
  })
})
