import { useState, useCallback } from 'react';
import { Camera, Upload, User, CheckCircle, XCircle, RefreshCw, Trash2, Plus } from 'lucide-react';
import { clsx } from '../lib/format';

interface SelfClone {
  id: string;
  name: string;
  status: 'processing' | 'ready' | 'failed';
  previewUrl?: string;
  confidenceScore?: number;
  createdAt: Date;
}

interface SelfCloneManagerProps {
  clones: SelfClone[];
  onCreateClone: (data: { name: string; photos: string[]; styleNotes: string }) => void;
  onDeleteClone: (id: string) => void;
}

export function SelfCloneManager({ clones, onCreateClone, onDeleteClone }: SelfCloneManagerProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [styleNotes, setStyleNotes] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const files = Array.from(e.dataTransfer.files);
      // Process files - in real app, upload to storage
      const newPhotos = files.map(file => URL.createObjectURL(file));
      setPhotos(prev => [...prev, ...newPhotos].slice(0, 5)); // Max 5 photos
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newPhotos = files.map(file => URL.createObjectURL(file));
      setPhotos(prev => [...prev, ...newPhotos].slice(0, 5));
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (name && photos.length >= 1) {
      onCreateClone({ name, photos, styleNotes });
      setIsCreating(false);
      setName('');
      setPhotos([]);
      setStyleNotes('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <User className="h-5 w-5 text-emerald-400" />
            Self-Clones
          </h3>
          <p className="text-sm text-zinc-500">Create AI versions of yourself</p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Clone
        </button>
      </div>

      {/* Clone List */}
      {clones.length > 0 && !isCreating && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clones.map((clone) => (
            <div
              key={clone.id}
              className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-zinc-700 flex items-center justify-center">
                    {clone.previewUrl ? (
                      <img src={clone.previewUrl} alt={clone.name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-zinc-500" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-white">{clone.name}</div>
                    <div className="text-xs text-zinc-500">
                      {new Date(clone.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onDeleteClone(clone.id)}
                  className="p-1 text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {clone.status === 'processing' && (
                  <>
                    <RefreshCw className="h-4 w-4 text-amber-400 animate-spin" />
                    <span className="text-sm text-amber-400">Processing...</span>
                  </>
                )}
                {clone.status === 'ready' && (
                  <>
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400">Ready</span>
                    {clone.confidenceScore && (
                      <span className="text-xs text-zinc-500">
                        ({Math.round(clone.confidenceScore * 100)}% match)
                      </span>
                    )}
                  </>
                )}
                {clone.status === 'failed' && (
                  <>
                    <XCircle className="h-4 w-4 text-red-400" />
                    <span className="text-sm text-red-400">Failed</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Clone Modal */}
      {isCreating && (
        <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-medium text-white">Create New Clone</h4>
            <button
              onClick={() => setIsCreating(false)}
              className="p-1 text-zinc-400 hover:text-white"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Clone Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My AI Avatar"
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Upload Photos (1-5)
            </label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={clsx(
                'relative border-2 border-dashed rounded-xl p-6 text-center transition-colors',
                dragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-700 hover:border-zinc-600'
              )}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-2">
                <Camera className="h-8 w-8 text-zinc-500" />
                <p className="text-sm text-zinc-400">
                  Drag & drop photos here or click to browse
                </p>
                <p className="text-xs text-zinc-500">
                  Use clear, well-lit photos from different angles
                </p>
              </div>
            </div>

            {/* Photo Preview */}
            {photos.length > 0 && (
              <div className="flex gap-2 mt-4 flex-wrap">
                {photos.map((photo, index) => (
                  <div key={index} className="relative">
                    <img
                      src={photo}
                      alt={`Photo ${index + 1}`}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white"
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Style Notes */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Style Notes (Optional)
            </label>
            <textarea
              value={styleNotes}
              onChange={(e) => setStyleNotes(e.target.value)}
              placeholder="Describe your mannerisms, speaking style, or any specific traits..."
              rows={3}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/50 resize-none"
            />
          </div>

          {/* Tips */}
          <div className="p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <h5 className="text-sm font-medium text-emerald-400 mb-2">📸 Photo Tips</h5>
            <ul className="text-xs text-zinc-400 space-y-1">
              <li>• Use 2-5 clear photos from different angles</li>
              <li>• Good lighting on your face</li>
              <li>• Include shoulders and upper body</li>
              <li>• Avoid sunglasses or heavy accessories</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!name || photos.length === 0}
              className={clsx(
                'flex items-center gap-2 px-6 py-2 rounded-xl font-medium transition-all',
                name && photos.length >= 1
                  ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              )}
            >
              <Upload className="h-4 w-4" />
              Create Clone
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {clones.length === 0 && !isCreating && (
        <div className="p-8 text-center bg-zinc-900/50 border border-zinc-800 rounded-xl">
          <User className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
          <h4 className="text-lg font-medium text-white mb-2">No Clones Yet</h4>
          <p className="text-sm text-zinc-500 mb-4">
            Create your first AI clone to appear in videos without filming
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 px-6 py-2 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-400 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Your First Clone
          </button>
        </div>
      )}
    </div>
  );
}
