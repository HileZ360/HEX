import { useState, useRef } from 'react';
import Modal from './Modal';
import { Button } from './ui/Button';
import { Camera, Upload, Check, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

interface TryOn2DModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (image: string) => void;
}

export function TryOn2DModal({ isOpen, onClose, onComplete }: TryOn2DModalProps) {
  const [step, setStep] = useState<'upload' | 'result'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Simulate upload
    setTimeout(() => setStep('result'), 1500);
  };

  const handleFileSelect = () => {
    // Simulate upload
    setTimeout(() => setStep('result'), 1500);
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
              "border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-colors cursor-pointer",
              isDragging ? "border-hex-primary bg-hex-primary/5" : "border-gray-200 hover:border-hex-primary/50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
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
            <Button>Выбрать фото</Button>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden relative">
            <img 
              src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80" 
              alt="Result" 
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs font-medium text-hex-dark">Размер M (автоподбор)</span>
              </div>
            </div>
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
              <Button className="w-full" onClick={() => onComplete('result-url')}>
                Сохранить результат
              </Button>
              <Button variant="secondary" className="w-full" icon={<RefreshCw size={18} />}>
                Примерить другой размер
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep('upload')}>
                Загрузить другое фото
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
