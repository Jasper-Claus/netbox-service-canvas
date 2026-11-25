import { useEffect, type ReactNode } from 'react';
import { t } from '../i18n';

interface Props {
  title: string;
  /** Optional MDI icon name shown next to the title, e.g. "mdi-cog-outline". */
  icon?: string;
  subtitle?: ReactNode;
  size?: 'md' | 'lg';
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Bootstrap-styled modal rendered by React (independent of NetBox's own Bootstrap JS). */
export function Modal({ title, icon, subtitle, size = 'md', onClose, children, footer }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="nsc-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`nsc-modal nsc-modal-${size} modal-content`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-header nsc-modal-header">
          {icon && (
            <span className="nsc-modal-icon">
              <i className={`mdi ${icon}`} />
            </span>
          )}
          <div className="flex-grow-1 min-w-0">
            <h5 className="modal-title">{title}</h5>
            {subtitle && <div className="nsc-modal-subtitle">{subtitle}</div>}
          </div>
          <button type="button" className="btn-close" aria-label={t('Close')} onClick={onClose} />
        </div>
        <div className="modal-body nsc-modal-body">{children}</div>
        {footer && <div className="modal-footer nsc-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

/** A titled block inside a modal or panel. */
export function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="nsc-section">
      <div className="nsc-section-title">{title}</div>
      {hint && <div className="nsc-section-hint">{hint}</div>}
      {children}
    </section>
  );
}
