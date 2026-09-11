import { useEffect, useRef, type CSSProperties } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";

/* The composer's editor: what you see is the message the recipient gets.

   White, dark text, Gmail's own font and size — the same page EmailBody
   shows for a sent message — rather than a dark approximation of it. A line
   is a paragraph with no margin, and a blank line is an empty one, which is
   how Gmail's own composer behaves and how render.ts sends it.

   Deliberately small. Bold, italic, underline, two kinds of list and a
   link: what a person writing to another person actually uses. Headings,
   code, colours and images are left out because they make a note read like
   a newsletter, and the server's allowlist would drop them anyway. */

type Props = {
  /** The body as HTML. "" is empty, and setting it to "" clears the editor. */
  html: string;
  /** Called with the HTML and its plain text on every edit. */
  onChange: (html: string, text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
};

export function RichEditor({
  html, onChange, disabled = false, placeholder = "", className = "", style,
}: Props) {
  // The editor is created once; a ref keeps its update handler pointing at
  // the latest onChange instead of the one from the first render.
  const changed = useRef(onChange);
  useEffect(() => { changed.current = onChange; });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false, code: false, codeBlock: false, blockquote: false,
        horizontalRule: false, strike: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: html,
    editable: !disabled,
    onUpdate: ({ editor: e }) =>
      changed.current(e.isEmpty ? "" : e.getHTML(), e.getText({ blockSeparator: "\n" })),
  });

  const on = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"),
      bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), link: e.isActive("link"),
    }),
  });

  useEffect(() => { editor.setEditable(!disabled, false); }, [editor, disabled]);

  // The parent clears the draft after a send or a discard, but the editor
  // keeps its own document and has to be told.
  useEffect(() => {
    if (html === "" && !editor.isEmpty) editor.commands.clearContent();
  }, [editor, html]);

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address — leave empty to remove the link", prev ?? "https://");
    if (url === null) return;
    const chain = editor.chain().focus().extendMarkRange("link");
    if (url.trim()) chain.setLink({ href: url.trim() }).run();
    else chain.unsetLink().run();
  };

  // onMouseDown is prevented so a click on the toolbar does not take focus
  // from the text — the selection it acts on would be gone by then.
  const button = (active: boolean, title: string, label: React.ReactNode, run: () => void) => (
    <button type="button" className={`of-rte__b${active ? " is-on" : ""}`} title={title}
            aria-label={title} aria-pressed={active} disabled={disabled}
            onMouseDown={(e) => e.preventDefault()} onClick={run}>
      {label}
    </button>
  );

  return (
    <div className={`of-rte ${className}`} style={style}>
      <div className="of-rte__bar" role="toolbar" aria-label="Formatting">
        {button(on.bold, "Bold (⌘B)", <b>B</b>, () => editor.chain().focus().toggleBold().run())}
        {button(on.italic, "Italic (⌘I)", <i>I</i>, () => editor.chain().focus().toggleItalic().run())}
        {button(on.underline, "Underline (⌘U)", <u>U</u>,
                () => editor.chain().focus().toggleUnderline().run())}
        <span className="of-rte__sep" aria-hidden />
        {button(on.bullet, "Bulleted list", "• List",
                () => editor.chain().focus().toggleBulletList().run())}
        {button(on.ordered, "Numbered list", "1. List",
                () => editor.chain().focus().toggleOrderedList().run())}
        <span className="of-rte__sep" aria-hidden />
        {button(on.link, "Link (⌘K)", "Link", setLink)}
      </div>
      {/* A click on the empty space below the text should still put the
          cursor in it, as it would in a mail client. */}
      <div className="of-rte__area"
           onMouseDown={(e) => {
             if (e.target === e.currentTarget) { e.preventDefault(); editor.commands.focus("end"); }
           }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
