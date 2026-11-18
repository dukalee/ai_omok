import { python } from '@codemirror/lang-python'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo } from 'react'
import type { ReactNode } from 'react'

/** 카드 안에 들어가는 밝은 에디터 테마 */
const makeTheme = (size: number) =>
  EditorView.theme(
    {
      '&': {
        backgroundColor: 'var(--card)',
        color: 'var(--ink)',
        fontSize: `${size}px`,
      },
      '.cm-content': {
        fontFamily: 'var(--font-code)',
        caretColor: 'var(--ink)',
        padding: '8px 0',
      },
      '.cm-gutters': {
        backgroundColor: 'var(--card)',
        color: 'var(--faint)',
        border: 'none',
        fontFamily: 'var(--font-code)',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
        color: 'var(--ink)',
      },
      '&.cm-focused': {
        outline: '2px solid var(--accent)',
        outlineOffset: '-2px',
      },
      '.cm-scroller': { lineHeight: '1.8' },
    },
    { dark: false },
  )

export interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  /** 실행 중에는 읽기 전용 */
  disabled: boolean
  /** 글자 크기(px) */
  fontSize: number
  /** 에디터 위에 겹쳐 놓을 조작부 (오른쪽 아래) */
  children?: ReactNode
}

export default function CodeEditor({ value, onChange, disabled, fontSize, children }: CodeEditorProps) {
  // 글자 크기가 바뀌면 테마를 새로 만들어 CodeMirror가 줄 높이를 다시 재게 한다
  const theme = useMemo(() => makeTheme(fontSize), [fontSize])
  // 부모(.editor-wrap)가 카드의 남는 높이를 모두 차지하고, 에디터는 그 안을 가득 채운다.
  // 코드가 길어지면 에디터 안에서 스크롤된다.
  return (
    <div className="editor-wrap">
      <div className="editor-fill">
        <CodeMirror
          value={value}
          onChange={onChange}
          height="100%"
          theme="light"
          extensions={[python(), theme]}
          editable={!disabled}
          readOnly={disabled}
          basicSetup={{
            foldGutter: false,
            highlightActiveLine: false,
            highlightActiveLineGutter: false,
          }}
          aria-label="Python 코드 에디터"
        />
      </div>
      {children}
    </div>
  )
}
