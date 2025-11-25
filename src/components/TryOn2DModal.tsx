import { useState, useRef } from 'react';
import Modal from './Modal';
import { Button } from './ui/Button';
import { Camera, Upload, Check, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

interface TryOn2DModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (payload: { image: string; recommendedSize?: string; confidence?: number }) => void;
  suggestedSize?: string;
  suggestedConfidence?: number;
}

export function TryOn2DModal({ isOpen, onClose, onComplete, suggestedSize, suggestedConfidence }: TryOn2DModalProps) {
  const [step, setStep] = useState<'upload' | 'result'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [resultRecommendation, setResultRecommendation] = useState<string | undefined>(undefined);
  const [resultSize, setResultSize] = useState<string | undefined>(suggestedSize);
  const [resultConfidence, setResultConfidence] = useState<number | undefined>(suggestedConfidence);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileSelect = () => {
    const files = fileInputRef.current?.files;
    handleFiles(files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetState = () => {
    setStep('upload');
    setResultImage(null);
    setResultRecommendation(undefined);
    setResultSize(suggestedSize);
    setResultConfidence(suggestedConfidence);
    setError(null);
    setUploadMessage(null);
    setIsSubmitting(false);
  };

  const handleFiles = (files: FileList | null | undefined) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, загрузите файл изображения.');
      return;
    }

    const maxSizeMb = 10;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setError(`Размер файла не должен превышать ${maxSizeMb} МБ.`);
      return;
    }

    setError(null);
    setResultImage(null);
    setResultRecommendation(undefined);
    setResultSize(suggestedSize);
    setResultConfidence(suggestedConfidence);
    setStep('upload');
    startTryOn(file);
  };

  const startTryOn = async (file: File) => {
    setIsSubmitting(true);
    setUploadMessage('Загружаем фото...');
    try {
      const formData = new FormData();
      formData.append('image', file);
      if (suggestedSize) {
        formData.append('suggestedSize', suggestedSize);
      }

      const response = await fetch('/api/tryon/2d', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type');
      const data = contentType?.includes('application/json') ? await response.json() : null;

      if (!response.ok) {
        throw new Error(data?.message || 'Не удалось создать примерку. Попробуйте еще раз.');
      }

      const finalImage = data?.imageUrl || data?.image || data?.renderedImage;
      if (!finalImage) {
        throw new Error('Сервер не вернул результат примерки.');
      }

      setUploadMessage('Обрабатываем изображение...');
      setResultImage(finalImage);
      setResultRecommendation(data?.recommendation || data?.recommendationText);
      setResultSize(data?.recommendedSize ?? suggestedSize);
      setResultConfidence(data?.confidence ?? suggestedConfidence);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке.');
    } finally {
      setIsSubmitting(false);
      setUploadMessage(null);
    }
  };

  const completeTryOn = () => {
    if (!resultImage) return;
    onComplete({
      image: resultImage,
      recommendedSize: resultSize,
      confidence: resultConfidence,
    });
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={step === 'upload' ? "Загрузите ваше фото" : "2D примерка готова"}
      className="max-w-2xl"
    >
      {step === 'upload' ? (
        <div className="space-y-6">
          <p className="text-hex-gray text-center">
            Для лучшего результата используйте фото в полный рост на однотонном фоне
          </p>
          
          <div
            className={clsx(
              'border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-colors cursor-pointer relative',
              isDragging ? 'border-hex-primary bg-hex-primary/5' : 'border-gray-200 hover:border-hex-primary/50',
              isSubmitting && 'opacity-70 pointer-events-none'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isSubmitting && fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileSelect}
            />
            <div className="w-16 h-16 bg-hex-primary/10 rounded-full flex items-center justify-center mb-4 text-hex-primary">
              <Camera size={32} />
            </div>
            <p className="text-lg font-medium text-hex-dark mb-2">
              Перетащите файл сюда
            </p>
            <p className="text-sm text-hex-gray mb-6">
              или нажмите, чтобы выбрать
            </p>
            <Button icon={<Upload size={18} />} disabled={isSubmitting}>
              {isSubmitting ? 'Загружаем...' : 'Выбрать фото'}
            </Button>

            {isSubmitting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 rounded-2xl">
                <RefreshCw className="animate-spin text-hex-primary mb-2" size={28} />
                <p className="text-sm text-hex-gray">{uploadMessage ?? 'Обработка...'}</p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden relative">
            {resultImage ? (
              <img src={resultImage} alt="Результат примерки" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-hex-gray text-sm">
                Изображение недоступно
              </div>
            )}
            {(resultSize || resultRecommendation) && (
              <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-sm space-y-1">
                {resultSize && (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs font-medium text-hex-dark">Размер {resultSize} (автоподбор)</span>
                  </div>
                )}
                {resultRecommendation && (
                  <p className="text-xs text-hex-gray">{resultRecommendation}</p>
                )}
              </div>
            )}
          </div>
          
          <div className="flex flex-col justify-center space-y-6">
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-start gap-3">
              <div className="bg-green-100 p-1 rounded-full text-green-600 mt-0.5">
                <Check size={16} />
              </div>
              <div>
                <h4 className="font-medium text-green-900">Образ создан</h4>
                <p className="text-sm text-green-700 mt-1">
                  AI успешно наложил одежду на ваше фото
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Button className="w-full" onClick={completeTryOn} disabled={!resultImage}>
                Сохранить результат
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                icon={<RefreshCw size={18} />}
                onClick={() => setStep('upload')}
              >
                Примерить другой размер
              </Button>
              <Button variant="ghost" className="w-full" onClick={resetState}>
                Загрузить другое фото
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
