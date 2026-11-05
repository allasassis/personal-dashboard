import { useState } from 'react';
import { newId } from '../../core/collection';
import { navigate } from '../../core/router';
import { useRecords } from '../../core/store';
import { Button, Field, Icon, Segmented, Sheet } from '../../core/ui';
import { ARTS, CoverArt } from './art';
import { covers, notebooks, type Notebook } from './data';

const MAX_SIDE = 900;
const MAX_LENGTH = 180_000; // about 135 KB of image

/** Shrinks a photo to a JPEG small enough to live in the data repo and sync quickly. */
export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // transparent PNGs would otherwise turn black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let url = '';
  for (const quality of [0.78, 0.62, 0.45, 0.3]) {
    url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= MAX_LENGTH) break;
  }
  return url;
}

type CoverProps = Pick<Notebook, 'id' | 'coverKind' | 'art' | 'coverUrl'>;

export function CoverImage({ notebook }: { notebook: CoverProps }) {
  const all = useRecords(covers);
  const [failed, setFailed] = useState(false);
  const src = notebook.coverKind === 'upload' ? all.find((c) => c.id === notebook.id)?.dataUrl : notebook.coverKind === 'url' ? notebook.coverUrl : undefined;
  if (!src || failed) return <CoverArt art={notebook.art} />;
  return <img src={src} alt="" onError={() => setFailed(true)} />;
}

export const BookCover = ({ notebook }: { notebook: CoverProps & { name: string } }) => (
  <div className="cover cover-book">
    <CoverImage notebook={notebook} />
    <div className="cover-label">{notebook.name || 'Untitled'}</div>
  </div>
);

/** Fills new notebooks with a different cover each time, rather than always the first. */
const nextArt = () => ARTS[notebooks.list().length % ARTS.length].id;

export function NotebookSheet({ notebook, onClose }: { notebook?: Notebook; onClose: () => void }) {
  const [name, setName] = useState(notebook?.name ?? '');
  const [description, setDescription] = useState(notebook?.description ?? '');
  const [kind, setKind] = useState<Notebook['coverKind']>(notebook?.coverKind ?? 'art');
  const [art, setArt] = useState(notebook?.art ?? nextArt);
  const [url, setUrl] = useState(notebook?.coverUrl ?? '');
  const [upload, setUpload] = useState<string | null>(notebook ? (covers.get(notebook.id)?.dataUrl ?? null) : null);
  const [error, setError] = useState<string | null>(null);
  const [draftId] = useState(() => notebook?.id ?? newId());

  const validUrl = /^https:\/\//.test(url.trim());
  const coverOk = kind === 'art' || (kind === 'url' && validUrl) || (kind === 'upload' && !!upload);

  const save = () => {
    if (!name.trim() || !coverOk) return;
    const hadUpload = !!covers.get(draftId)?.dataUrl;
    if (kind === 'upload' && upload !== covers.get(draftId)?.dataUrl) covers.put({ id: draftId, dataUrl: upload! });
    // Clear rather than delete: a deleted record would keep the image data in the file.
    if (kind !== 'upload' && hadUpload) covers.put({ id: draftId, dataUrl: '' });
    notebooks.put({
      id: draftId,
      name: name.trim(),
      coverKind: kind,
      art,
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(kind === 'url' ? { coverUrl: url.trim() } : {}),
    });
    if (notebook) onClose();
    else navigate(`/studies/notebooks/${draftId}`);
  };

  return (
    <Sheet
      title={notebook ? 'Edit notebook' : 'New notebook'}
      onClose={onClose}
      footer={<Button variant="primary" disabled={!name.trim() || !coverOk} onClick={save}>{notebook ? 'Save' : 'Create notebook'}</Button>}
    >
      <div className="stack">
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Linear Algebra" />
        </Field>
        <Field label="Description (optional)">
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Second semester, Prof. Lima" />
        </Field>
        <Segmented
          label="Cover type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'art', label: 'Gallery' },
            { value: 'upload', label: 'Upload' },
            { value: 'url', label: 'Link' },
          ]}
        />
        {kind === 'art' && (
          <div className="art-grid">
            {ARTS.map((a) => (
              <button type="button" key={a.id} className="art-pick" aria-pressed={a.id === art} aria-label={a.name} title={a.name} onClick={() => setArt(a.id)}>
                <div className="cover cover-thumb"><CoverArt art={a.id} /></div>
              </button>
            ))}
          </div>
        )}
        {kind === 'upload' && (
          <div className="row wrap top">
            {upload && (
              <div className="upload-preview">
                <div className="cover cover-thumb"><img src={upload} alt="Cover preview" /></div>
              </div>
            )}
            <div className="stack grow">
              <div>
                <label className="btn btn-ghost file-btn">
                  <Icon name="image" size={16} /> {upload ? 'Choose another image' : 'Choose an image'}
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Choose an image"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setError(null);
                      try {
                        setUpload(await compressImage(file));
                      } catch {
                        setError('That file could not be read as an image. Try a JPEG or PNG.');
                      }
                    }}
                  />
                </label>
              </div>
              <p className="small muted">Shrunk and saved to your private repo, so it appears on all your devices, even offline.</p>
              {error && <p className="notice notice-bad" role="alert">{error}</p>}
            </div>
          </div>
        )}
        {kind === 'url' && (
          <Field label="Image link" hint={!url.trim() || validUrl ? 'Any https:// link to an image. It needs a connection to load, and the gallery cover shows if it fails.' : 'The link has to start with https://'}>
            <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/cover.jpg" inputMode="url" />
          </Field>
        )}
      </div>
    </Sheet>
  );
}
