import { APPLICATION_ICONS } from '../choices';
import { t } from '../i18n';

interface Props {
  /** Selected icon class; empty = default icon (the first one). */
  value: string;
  onChange: (icon: string) => void;
  disabled?: boolean;
  idPrefix?: string;
}

/** Grid of icon buttons for applications. Picking the default icon stores an empty value. */
export function IconPicker({ value, onChange, disabled, idPrefix = 'nsc-icon' }: Props) {
  const current = value || APPLICATION_ICONS[0][0];
  return (
    <div className="nsc-icon-picker" role="radiogroup" aria-label={t('Icon')} id={idPrefix}>
      {APPLICATION_ICONS.map(([icon, label], index) => (
        <button
          key={icon}
          type="button"
          role="radio"
          aria-checked={current === icon}
          className={`nsc-icon-option${current === icon ? ' active' : ''}`}
          title={t(label)}
          disabled={disabled}
          onClick={() => onChange(index === 0 ? '' : icon)}
        >
          <i className={`mdi ${icon}`} />
        </button>
      ))}
    </div>
  );
}
