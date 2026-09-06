import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { SpeakerNotes } from "./presentation/SpeakerNotes";
import { getPresentationFromHash } from "./presentations";
import "./styles/theme.css";

function NotesApp() {
  const [presentation, setPresentation] = useState(() =>
    getPresentationFromHash(window.location.hash),
  );

  useEffect(() => {
    const onHashChange = () =>
      setPresentation(getPresentationFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <SpeakerNotes
      key={presentation.id}
      slides={presentation.slides}
      deckTitle={presentation.title}
      deckId={presentation.id}
    />
  );
}

createRoot(document.getElementById("notes-root")!).render(<NotesApp />);
