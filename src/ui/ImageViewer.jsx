import { useEffect, useState } from 'react';
import { Icon } from './Icon.jsx';
import { Modal, SecureImage } from './common.jsx';
import { useI18n } from '../app/i18n.js';

export function ImageViewer({ images, start, onClose }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(start);
  const count = images.length;
  const step = delta => setIndex(i => (i + delta + count) % count);

  useEffect(() => {
    const onKey = event => {
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count]);

  return (
    <Modal title={count > 1 ? t('viewer.counter', { index: index + 1, count }) : t('viewer.title')} onClose={onClose} size="viewer">
      <div className="viewer">
        <SecureImage key={images[index].id} id={images[index].id} className="viewer-img" />
        {count > 1 && (
          <>
            <button type="button" className="viewer-nav prev" aria-label={t('viewer.prev')} onClick={() => step(-1)}><Icon name="back" size={22} /></button>
            <button type="button" className="viewer-nav next" aria-label={t('viewer.next')} onClick={() => step(1)}><Icon name="next" size={22} /></button>
          </>
        )}
      </div>
    </Modal>
  );
}
