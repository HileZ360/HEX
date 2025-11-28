import { useEffect, useState } from 'react';
import Modal from './Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Info, Check, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

interface TryOn3DModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (payload: { image?: string; recommendedSize?: string; confidence?: number }) => void;
  suggestedSize?: string;
  suggestedConfidence?: number;
}

export function TryOn3DModal({ isOpen, onClose, onComplete, suggestedSize, suggestedConfidence }: TryOn3DModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [saveParams, setSaveParams] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<string | undefined>(suggestedSize);
  const [resultConfidence, setResultConfidence] = useState<number | undefined>(suggestedConfidence);
  const [previewImage, setPreviewImage] = useState<string | undefined>();
  const [fitMetrics, setFitMetrics] = useState<{ label: string; status: string; score: number; detail?: string }[]>([]);

  const resetState = () => {
    setStep(1);
    setGender('female');
    setHeight('');
    setWeight('');
    setChest('');
    setWaist('');
    setHips('');
    setSaveParams(false);
    setErrors({});
    setIsSubmitting(false);
    setSubmitError(null);
    setResultSize(suggestedSize);
    setResultConfidence(suggestedConfidence);
    setPreviewImage(undefined);
    setFitMetrics([]);
  };

  useEffect(() => {
    if (!isOpen) {
      resetState();
      return;
    }

    setResultSize(suggestedSize);
    setResultConfidence(suggestedConfidence);
  }, [isOpen, suggestedSize, suggestedConfidence]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    const validateNumber = (value: string, field: string) => {
      if (!value) {
        newErrors[field] = 'Заполните это поле';
        return;
      }

      const numeric = Number(value);
      if (Number.isNaN(numeric) || numeric <= 0) {
        newErrors[field] = 'Введите положительное число';
      }
    };

    validateNumber(height, 'height');
    validateNumber(weight, 'weight');
    validateNumber(chest, 'chest');
    validateNumber(waist, 'waist');
    validateNumber(hips, 'hips');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (isSubmitting) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/tryon/3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gender,
          height: Number(height),
          weight: Number(weight),
          chest: Number(chest),
          waist: Number(waist),
          hips: Number(hips),
          saveParams,
          suggestedSize,
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Сервис 3D примерки временно недоступен. Попробуйте ещё раз позже.');
      }

      const nextSize = data?.recommendedSize ?? suggestedSize;
      const nextConfidence = data?.confidence ?? suggestedConfidence;
      const nextPreview = data?.renderedImage ?? data?.imageUrl ?? data?.image;
      const metrics = Array.isArray(data?.fitMetrics)
        ? data.fitMetrics
            .filter((metric: any) => metric?.label && metric?.status)
            .map((metric: any) => ({
              label: String(metric.label),
              status: String(metric.status),
              score: typeof metric.score === 'number' ? metric.score : 65,
              detail: metric.detail ? String(metric.detail) : undefined,
            }))
        : [];

      setResultSize(nextSize);
      setResultConfidence(nextConfidence);
      setPreviewImage(nextPreview);
      setFitMetrics(metrics);
      setStep(2);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Произошла ошибка. Попробуйте снова.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 1 ? "Параметры тела" : "Результат примерки"}
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
              <Input
                label="Рост"
                placeholder="170"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                error={errors.height}
                rightElement={<span className="text-gray-400 text-sm">см</span>}
              />
              <Input
                label="Вес"
                placeholder="60"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                error={errors.weight}
                rightElement={<span className="text-gray-400 text-sm">кг</span>}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Грудь"
                placeholder="90"
                value={chest}
                onChange={(e) => setChest(e.target.value)}
                error={errors.chest}
              />
              <Input
                label="Талия"
                placeholder="65"
                value={waist}
                onChange={(e) => setWaist(e.target.value)}
                error={errors.waist}
              />
              <Input
                label="Бёдра"
                placeholder="95"
                value={hips}
                onChange={(e) => setHips(e.target.value)}
                error={errors.hips}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="save-params"
                className="rounded border-gray-300 text-hex-primary focus:ring-hex-primary"
                checked={saveParams}
                onChange={(e) => setSaveParams(e.target.checked)}
              />
              <label htmlFor="save-params" className="text-sm text-hex-gray">
                Сохранить параметры для следующих примерок
              </label>
            </div>

            <div className="pt-2">
              <Button className="w-full" onClick={handleNext} disabled={isSubmitting} icon={isSubmitting ? <RefreshCw size={18} className="animate-spin" /> : undefined}>
                {isSubmitting ? 'Рассчитываем параметры...' : 'Продолжить к примерке'}
              </Button>
              <button className="w-full mt-3 text-sm text-hex-gray hover:text-hex-primary transition-colors">
                Пропустить и использовать усреднённый аватар
              </button>

              {submitError && (
                <div className="mt-3 bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-sm">
                  {submitError}
                </div>
              )}
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
              src={
                previewImage ??
                'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80'
              }
              alt="3D Avatar"
              className="h-[90%] object-contain relative z-10 mix-blend-multiply opacity-80 grayscale"
            />
          </div>

          <div className="flex flex-col justify-center space-y-8">
            <div>
              <h3 className="text-2xl font-bold text-hex-dark mb-2">Рекомендуемый размер: {resultSize ?? 'M'}</h3>
              <p className="text-hex-gray">
                {resultConfidence
                  ? `Идеальная посадка (${Math.round((resultConfidence <= 1 ? resultConfidence * 100 : resultConfidence))}% совпадение)`
                  : 'Идеальная посадка по вашим параметрам'}
              </p>
            </div>

            <div className="space-y-6">
              {(fitMetrics.length > 0
                ? fitMetrics
                : [
                    { label: 'По груди', status: 'Комфортно', score: 70 },
                    { label: 'По талии', status: 'Комфортно', score: 65 },
                    { label: 'По бёдрам', status: 'Свободно', score: 75 },
                  ]
              ).map((metric, i) => (
                <div key={`${metric.label}-${i}`}>
                  <div className="flex justify-between text-sm mb-2">
                    <div className="space-y-1">
                      <span className="font-medium text-hex-dark block">{metric.label}</span>
                      {metric.detail && <span className="text-xs text-hex-gray">{metric.detail}</span>}
                    </div>
                    <span className="text-hex-primary font-medium">{metric.status}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-hex-primary/60 rounded-full"
                      style={{ width: `${Math.min(Math.max(metric.score, 0), 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full"
              onClick={() =>
                onComplete({
                  image: previewImage,
                  recommendedSize: resultSize,
                  confidence: resultConfidence,
                })
              }
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
