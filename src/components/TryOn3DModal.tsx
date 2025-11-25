import { useState } from 'react';
import Modal from './Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Info, ArrowRight, Check } from 'lucide-react';
import { clsx } from 'clsx';

interface TryOn3DModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (payload: { recommendedSize?: string; confidence?: number }) => void;
  suggestedSize?: string;
  suggestedConfidence?: number;
}

export function TryOn3DModal({ isOpen, onClose, onComplete, suggestedSize, suggestedConfidence }: TryOn3DModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [gender, setGender] = useState<'male' | 'female'>('female');

  const handleNext = () => {
    // Simulate processing
    setTimeout(() => setStep(2), 1000);
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={step === 1 ? "Параметры тела" : "Результат примерки"}
      className="max-w-3xl"
    >
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-sm font-medium text-hex-gray mb-2">
          <span className={clsx(step >= 1 && "text-hex-primary")}>Параметры</span>
          <span className={clsx(step >= 2 && "text-hex-primary")}>Результат</span>
        </div>
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-hex-primary transition-all duration-500"
            style={{ width: step === 1 ? '50%' : '100%' }}
          />
        </div>
      </div>

      {step === 1 ? (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Form */}
          <div className="space-y-6">
            <div className="flex gap-4">
              <button
                className={clsx(
                  "flex-1 py-3 rounded-xl font-medium transition-all border-2",
                  gender === 'female' 
                    ? "border-hex-primary bg-hex-primary/5 text-hex-primary" 
                    : "border-gray-100 text-hex-gray hover:border-gray-200"
                )}
                onClick={() => setGender('female')}
              >
                Женская
              </button>
              <button
                className={clsx(
                  "flex-1 py-3 rounded-xl font-medium transition-all border-2",
                  gender === 'male' 
                    ? "border-hex-primary bg-hex-primary/5 text-hex-primary" 
                    : "border-gray-100 text-hex-gray hover:border-gray-200"
                )}
                onClick={() => setGender('male')}
              >
                Мужская
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="Рост" placeholder="170" rightElement={<span className="text-gray-400 text-sm">см</span>} />
              <Input label="Вес" placeholder="60" rightElement={<span className="text-gray-400 text-sm">кг</span>} />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <Input label="Грудь" placeholder="90" />
              <Input label="Талия" placeholder="65" />
              <Input label="Бёдра" placeholder="95" />
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="save-params" className="rounded border-gray-300 text-hex-primary focus:ring-hex-primary" />
              <label htmlFor="save-params" className="text-sm text-hex-gray">
                Сохранить параметры для следующих примерок
              </label>
            </div>

            <div className="pt-2">
              <Button className="w-full" onClick={handleNext}>
                Продолжить к примерке
              </Button>
              <button className="w-full mt-3 text-sm text-hex-gray hover:text-hex-primary transition-colors">
                Пропустить и использовать усреднённый аватар
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="bg-hex-bg rounded-2xl p-6 h-fit">
            <div className="flex items-center gap-3 mb-4 text-hex-primary">
              <Info size={24} />
              <h4 className="font-bold">Как работает HEX</h4>
            </div>
            <ul className="space-y-4">
              {[
                "Мы строим упрощённый 3D-силуэт по вашим меркам",
                "Алгоритм оценивает посадку вещи по размерной сетке бренда",
                "Вы получаете точную рекомендацию размера и подсказки по посадке"
              ].map((item, i) => (
                <li key={i} className="flex gap-3 text-sm text-hex-gray leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-hex-secondary mt-2 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          <div className="aspect-[3/4] bg-gray-50 rounded-xl flex items-center justify-center relative overflow-hidden">
            {/* Placeholder for 3D Avatar */}
            <div className="absolute inset-0 bg-gradient-to-b from-gray-50 to-gray-100"></div>
            <img 
              src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80" 
              alt="3D Avatar" 
              className="h-[90%] object-contain relative z-10 mix-blend-multiply opacity-80 grayscale"
            />
          </div>

          <div className="flex flex-col justify-center space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-hex-dark mb-2">Рекомендуемый размер: {suggestedSize ?? 'M'}</h3>
              <p className="text-hex-gray">
                {suggestedConfidence
                  ? `Идеальная посадка (${Math.round((suggestedConfidence <= 1 ? suggestedConfidence * 100 : suggestedConfidence))}% совпадение)`
                  : 'Идеальная посадка по вашим параметрам'}
              </p>
            </div>

            <div className="space-y-6">
              {[
                { label: "По груди", value: 70, status: "Комфортно" },
                { label: "По талии", value: 50, status: "Свободно" },
                { label: "По длине", value: 85, status: "Стандартно" }
              ].map((metric, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-hex-dark">{metric.label}</span>
                    <span className="text-hex-primary">{metric.status}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-hex-primary/60 rounded-full"
                      style={{ width: `${metric.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full"
              onClick={() => onComplete({ recommendedSize: suggestedSize, confidence: suggestedConfidence })}
              icon={<Check size={20} />}
            >
              Применить этот размер
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
