import { useEffect, useId, useRef } from 'react';

export default function CommunityDialog({ title, description, dismissible = true, onClose, children }) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  function requestClose(event) {
    event.preventDefault();
    if (dismissible) onClose();
  }
  return <dialog ref={ref} className="community-dialog" onCancel={requestClose} onClick={event => { if (dismissible && event.target === event.currentTarget) onClose(); }} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
    <div className="community-dialog-heading"><h2 id={titleId}>{title}</h2><button type="button" className="community-icon-button" aria-label="Close dialog" disabled={!dismissible} onClick={onClose}>×</button></div>
    {description && <p id={descriptionId} className="community-dialog-intro">{description}</p>}
    {children}
  </dialog>;
}
