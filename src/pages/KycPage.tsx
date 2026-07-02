import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ShieldCheck, Camera, FileText, CheckCircle2, XCircle,
  Loader2, AlertCircle, RefreshCw, ArrowLeft, ArrowRight, Image as ImageIcon, CreditCard, Clock
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase, type KycVerificationRow, type KycIdType } from '../lib/supabase';
import { createNotification } from '../lib/notify';
import { useToast } from '../components/Toast';
import { navigate } from '../lib/router';

const ID_TYPES: { value: KycIdType; label: string }[] = [
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'passport', label: 'Passport' },
  { value: 'voter_id', label: 'Voter ID' },
  { value: 'driving_license', label: 'Driving License' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

type Step = 'form' | 'documents' | 'selfie' | 'review' | 'submitting';
type CameraState = 'idle' | 'requesting' | 'active' | 'denied' | 'unsupported' | 'error';

export function KycPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const toast = useToast();

  const [pageState, setPageState] = useState<'loading' | 'ready' | 'error' | 'not_found'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [existingKyc, setExistingKyc] = useState<KycVerificationRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState({
    full_name: '',
    date_of_birth: '',
    country: 'India',
    id_type: 'aadhaar' as KycIdType,
    id_number: '',
  });
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
      return;
    }
    if (!user) return;

    let mounted = true;
    setDataLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('kyc_verifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          setErrorMessage(error.message);
          setPageState('error');
        } else if (data) {
          setExistingKyc(data as KycVerificationRow);
          setPageState('ready');
        } else {
          setExistingKyc(null);
          setPageState('ready');
        }
      } catch (err: any) {
        if (!mounted) return;
        setErrorMessage(err?.message || 'Failed to load KYC data.');
        setPageState('error');
      } finally {
        if (mounted) setDataLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [user, loading]);

  useEffect(() => {
    if (profile?.full_name && !form.full_name) {
      setForm((f) => ({ ...f, full_name: profile.full_name }));
    }
  }, [profile]);

  const status = existingKyc?.status || profile?.kyc_status || 'not_submitted';

  const compressImage = useCallback(async (file: File): Promise<string> => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      throw new Error('Only JPG, JPEG, and PNG files are allowed.');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size must be under 10MB.');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1280;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height / width) * maxDim);
              width = maxDim;
            } else {
              width = Math.round((width / height) * maxDim);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to process image.'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressed);
        };
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileUpload = useCallback(async (file: File, target: 'front' | 'back' | 'selfie') => {
    try {
      const compressed = await compressImage(file);
      if (target === 'front') setFrontImage(compressed);
      else if (target === 'back') setBackImage(compressed);
      else setSelfieImage(compressed);
      toast('success', `${target === 'front' ? 'Front ID' : target === 'back' ? 'Back ID' : 'Selfie'} uploaded.`);
    } catch (err: any) {
      toast('error', err?.message || 'Failed to upload image.');
    }
  }, [compressImage, toast]);

  const uploadToStorage = useCallback(async (imageData: string, fileName: string): Promise<string> => {
    const response = await fetch(imageData);
    const blob = await response.blob();
    const path = `${user!.id}/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from('kyc-documents')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from('kyc-documents').getPublicUrl(path);
    return urlData.publicUrl;
  }, [user]);

  const submit = async () => {
    if (!user) return;
    if (!form.full_name || !form.date_of_birth || !form.id_number || !frontImage || !selfieImage) {
      toast('error', 'Please complete all required fields.');
      return;
    }

    setSubmitting(true);
    setStep('submitting');
    try {
      const frontUrl = await uploadToStorage(frontImage, `front-${Date.now()}.jpg`);
      const selfieUrl = await uploadToStorage(selfieImage, `selfie-${Date.now()}.jpg`);
      let backUrl: string | null = null;
      if (backImage) {
        backUrl = await uploadToStorage(backImage, `back-${Date.now()}.jpg`);
      }

      const { error: insertError } = await supabase.from('kyc_verifications').insert({
        user_id: user.id,
        full_name: form.full_name,
        date_of_birth: form.date_of_birth,
        country: form.country,
        id_type: form.id_type,
        id_number: form.id_number,
        front_image: frontUrl,
        back_image: backUrl,
        selfie_image: selfieUrl,
        status: 'pending',
      });

      if (insertError) throw insertError;

      await supabase.from('profiles').update({ kyc_status: 'pending' }).eq('id', user.id);

      try {
        await createNotification(user.id, 'kyc', 'KYC Submitted', 'Your KYC verification is under review. We will notify you once approved.');
      } catch {
        /* notification failure is non-critical */
      }

      await refreshProfile();

      const { data: newKyc } = await supabase
        .from('kyc_verifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (newKyc) setExistingKyc(newKyc as KycVerificationRow);
      setStep('form');
      setFrontImage(null);
      setBackImage(null);
      setSelfieImage(null);
      toast('success', 'KYC submitted successfully! Under review.');
    } catch (err: any) {
      setStep('review');
      toast('error', err?.message || 'Failed to submit KYC.');
    } finally {
      setSubmitting(false);
    }
  };

  const retryLoad = () => {
    setPageState('loading');
    setErrorMessage('');
    setDataLoading(true);
    setTimeout(() => {
      const event = new Event('retry');
      window.dispatchEvent(event);
    }, 100);
  };

  useEffect(() => {
    const handler = () => {
      if (!user) return;
      (async () => {
        try {
          const { data, error } = await supabase
            .from('kyc_verifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (error) {
            setErrorMessage(error.message);
            setPageState('error');
          } else {
            setExistingKyc(data as KycVerificationRow | null);
            setPageState('ready');
          }
        } catch (err: any) {
          setErrorMessage(err?.message || 'Failed to load KYC data.');
          setPageState('error');
        } finally {
          setDataLoading(false);
        }
      })();
    };
    window.addEventListener('retry', handler);
    return () => window.removeEventListener('retry', handler);
  }, [user]);

  // ---- RENDER GUARDS ----

  if (loading || dataLoading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-gold-400 mx-auto" />
          <p className="mt-4 text-gray-400">Loading KYC verification...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (pageState === 'error') {
    return (
      <div className="min-h-[60vh] grid place-items-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle size={40} className="text-error-400 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-white mb-2">Failed to Load</h2>
          <p className="text-sm text-gray-400 mb-6">{errorMessage}</p>
          <button onClick={retryLoad} className="btn-gold inline-flex items-center gap-2">
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[60vh] grid place-items-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle size={40} className="text-warning-400 mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold text-white mb-2">Profile Not Found</h2>
          <p className="text-sm text-gray-400 mb-6">Your profile could not be loaded. Try logging out and back in.</p>
          <button onClick={() => navigate('/login')} className="btn-gold">Go to Login</button>
        </div>
      </div>
    );
  }

  // ---- STATUS BANNER (if already submitted) ----
  const showStatusOnly = existingKyc && (existingKyc.status === 'pending' || existingKyc.status === 'approved');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      <div className="mb-8">
        <span className="section-eyebrow">Verification</span>
        <h1 className="font-display text-3xl font-bold text-white">KYC Verification</h1>
        <p className="mt-2 text-gray-400">Verify your identity to become a trusted seller on Kryzo.</p>
      </div>

      {/* Status Banner */}
      <StatusBanner status={status} existingKyc={existingKyc} />

      {/* If approved or pending, don't show the form */}
      {showStatusOnly ? null : (
        <>
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {(['form', 'documents', 'selfie', 'review'] as Step[]).map((s, i) => {
              const stepOrder = ['form', 'documents', 'selfie', 'review', 'submitting'];
              const currentIdx = stepOrder.indexOf(step);
              const thisIdx = stepOrder.indexOf(s);
              const isComplete = currentIdx > thisIdx;
              const isCurrent = step === s;
              return (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold transition-all ${
                    isComplete ? 'bg-success-500 text-white' :
                    isCurrent ? 'bg-gold-400 text-ink-950' :
                    'bg-white/[0.06] text-gray-500'
                  }`}>
                    {isComplete ? <CheckCircle2 size={16} /> : i + 1}
                  </div>
                  {i < 3 && <div className={`w-12 h-0.5 mx-1 ${isComplete ? 'bg-success-500' : 'bg-white/[0.06]'}`} />}
                </div>
              );
            })}
          </div>

          {/* Step: Form */}
          {step === 'form' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <h2 className="font-display text-lg font-semibold text-white">Personal Information</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField label="Full Name (as on ID)" required>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="input-field"
                    placeholder="John Doe"
                  />
                </FormField>
                <FormField label="Date of Birth" required>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                    className="input-field"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </FormField>
                <FormField label="Country" required>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="input-field"
                  />
                </FormField>
                <FormField label="ID Type" required>
                  <select
                    value={form.id_type}
                    onChange={(e) => setForm({ ...form, id_type: e.target.value as KycIdType })}
                    className="input-field"
                  >
                    {ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </FormField>
                <FormField label="ID Number" required className="sm:col-span-2">
                  <input
                    type="text"
                    value={form.id_number}
                    onChange={(e) => setForm({ ...form, id_number: e.target.value })}
                    className="input-field"
                    placeholder="Enter your ID number"
                  />
                </FormField>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    if (!form.full_name || !form.date_of_birth || !form.id_number) {
                      toast('error', 'Please fill all required fields.');
                      return;
                    }
                    setStep('documents');
                  }}
                  className="btn-gold inline-flex items-center gap-2"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step: Documents */}
          {step === 'documents' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <h2 className="font-display text-lg font-semibold text-white">Upload ID Documents</h2>
              <p className="text-sm text-gray-400">Upload clear photos of your {ID_TYPES.find(t => t.value === form.id_type)?.label}. JPG, PNG only. Max 10MB.</p>

              <ImageUploadSlot
                label="Front of ID"
                required
                image={frontImage}
                onUpload={(file) => handleFileUpload(file, 'front')}
                onClear={() => setFrontImage(null)}
                icon={<CreditCard size={24} />}
              />

              <ImageUploadSlot
                label="Back of ID"
                image={backImage}
                onUpload={(file) => handleFileUpload(file, 'back')}
                onClear={() => setBackImage(null)}
                icon={<FileText size={24} />}
              />

              <div className="flex justify-between">
                <button onClick={() => setStep('form')} className="btn-ghost inline-flex items-center gap-2">
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  onClick={() => {
                    if (!frontImage) {
                      toast('error', 'Please upload the front of your ID.');
                      return;
                    }
                    setStep('selfie');
                  }}
                  className="btn-gold inline-flex items-center gap-2"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step: Selfie */}
          {step === 'selfie' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <h2 className="font-display text-lg font-semibold text-white">Selfie Verification</h2>
              <p className="text-sm text-gray-400">Take a selfie or upload a clear photo of your face.</p>

              <SelfieCapture
                image={selfieImage}
                onCapture={(file) => handleFileUpload(file, 'selfie')}
                onClear={() => setSelfieImage(null)}
              />

              <div className="flex justify-between">
                <button onClick={() => setStep('documents')} className="btn-ghost inline-flex items-center gap-2">
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  onClick={() => {
                    if (!selfieImage) {
                      toast('error', 'Please capture or upload a selfie.');
                      return;
                    }
                    setStep('review');
                  }}
                  className="btn-gold inline-flex items-center gap-2"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step: Review */}
          {step === 'review' && (
            <div className="glass rounded-2xl p-6 space-y-5">
              <h2 className="font-display text-lg font-semibold text-white">Review & Submit</h2>
              <p className="text-sm text-gray-400">Please verify your information before submitting.</p>

              <div className="grid sm:grid-cols-2 gap-4">
                <ReviewItem label="Full Name" value={form.full_name} />
                <ReviewItem label="Date of Birth" value={form.date_of_birth} />
                <ReviewItem label="Country" value={form.country} />
                <ReviewItem label="ID Type" value={ID_TYPES.find(t => t.value === form.id_type)?.label || ''} />
                <ReviewItem label="ID Number" value={form.id_number} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <ReviewImage label="Front ID" image={frontImage} />
                <ReviewImage label="Back ID" image={backImage} />
                <ReviewImage label="Selfie" image={selfieImage} />
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep('selfie')} className="btn-ghost inline-flex items-center gap-2">
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  onClick={submit}
                  disabled={submitting}
                  className="btn-gold inline-flex items-center gap-2"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  {submitting ? 'Submitting...' : 'Submit KYC'}
                </button>
              </div>
            </div>
          )}

          {/* Step: Submitting */}
          {step === 'submitting' && (
            <div className="glass rounded-2xl p-10 grid place-items-center">
              <Loader2 className="w-10 h-10 animate-spin text-gold-400 mb-4" />
              <p className="text-gray-400">Submitting your KYC verification...</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Status Banner Component
// ============================================================
function StatusBanner({ status, existingKyc }: { status: string; existingKyc: KycVerificationRow | null }) {
  const config = {
    approved: { bg: 'bg-success-500/10', border: 'border-success-500/30', icon: <CheckCircle2 className="text-success-400" />, title: 'KYC Approved', desc: 'Your identity has been verified. You are now a trusted seller.' },
    pending: { bg: 'bg-warning-500/10', border: 'border-warning-500/30', icon: <Clock className="text-warning-400" />, title: 'KYC Under Review', desc: 'Your submission is being reviewed. This usually takes 24-48 hours.' },
    rejected: { bg: 'bg-error-500/10', border: 'border-error-500/30', icon: <XCircle className="text-error-400" />, title: 'KYC Rejected', desc: existingKyc?.rejection_reason || 'Your KYC was rejected. Please resubmit with correct information.' },
    not_submitted: { bg: 'glass', border: 'border-white/[0.06]', icon: <ShieldCheck className="text-gold-400" />, title: 'Verification Required', desc: 'Complete KYC verification to start selling on Kryzo.' },
  };
  const c = config[status as keyof typeof config] || config.not_submitted;

  return (
    <div className={`rounded-2xl p-6 mb-6 border ${c.bg} ${c.border}`}>
      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-0.5">{c.icon}</div>
        <div>
          <h3 className="font-display text-lg font-semibold text-white">{c.title}</h3>
          <p className="mt-1 text-sm text-gray-400">{c.desc}</p>
          {existingKyc?.submitted_at && (
            <p className="mt-2 text-xs text-gray-500">Submitted on {new Date(existingKyc.submitted_at).toLocaleDateString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Form Field Component
// ============================================================
function FormField({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">
        {label} {required && <span className="text-error-400">*</span>}
      </label>
      {children}
    </div>
  );
}

// ============================================================
// Image Upload Slot Component
// ============================================================
function ImageUploadSlot({ label, required, image, onUpload, onClear, icon }: {
  label: string;
  required?: boolean;
  image: string | null;
  onUpload: (file: File) => void;
  onClear: () => void;
  icon: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">
        {label} {required && <span className="text-error-400">*</span>}
      </label>
      {image ? (
        <div className="relative group">
          <img src={image} alt={label} className="w-full max-h-64 object-contain rounded-xl border border-white/[0.06] bg-ink-900" />
          <button
            onClick={onClear}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-error-500/80 hover:bg-error-500 text-white grid place-items-center transition-colors"
          >
            <XCircle size={16} />
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) onUpload(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
            dragOver ? 'border-gold-400 bg-gold-400/5' : 'border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.02]'
          }`}
        >
          <div className="text-gray-500 mb-2 flex justify-center">{icon}</div>
          <p className="text-sm text-gray-400">Click to upload or drag & drop</p>
          <p className="text-xs text-gray-600 mt-1">JPG, PNG up to 10MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.target.value = '';
            }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Selfie Capture Component (Camera Only - No Upload)
// ============================================================
function SelfieCapture({ image, onCapture, onClear }: {
  image: string | null;
  onCapture: (file: File) => void;
  onClear: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [videoReady, setVideoReady] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState('idle');
    setVideoReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraState('requesting');
    setErrorMsg('');
    setVideoReady(false);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('unsupported');
      setErrorMsg('Camera is not supported on this device or browser. Please use a device with a camera.');
      return;
    }

    // Try front camera first, then fall back to any camera
    const constraints: MediaStreamConstraints[] = [
      { video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false },
      { video: true, audio: false },
    ];

    let lastError: Error | null = null;

    for (const constraint of constraints) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraint);
        streamRef.current = stream;

        // Set video srcObject immediately
        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          // Wait for video to be ready
          await new Promise<void>((resolve, reject) => {
            const video = videoRef.current;
            if (!video) {
              reject(new Error('Video element not available'));
              return;
            }

            const timeoutId = setTimeout(() => {
              reject(new Error('Camera startup timeout'));
            }, 15000);

            const onCanPlay = () => {
              clearTimeout(timeoutId);
              video.removeEventListener('canplay', onCanPlay);
              video.removeEventListener('loadeddata', onCanPlay);
              video.removeEventListener('error', onError);
              resolve();
            };

            const onError = (e: Event) => {
              clearTimeout(timeoutId);
              video.removeEventListener('canplay', onCanPlay);
              video.removeEventListener('loadeddata', onCanPlay);
              video.removeEventListener('error', onError);
              reject(new Error('Video error'));
            };

            video.addEventListener('canplay', onCanPlay);
            video.addEventListener('loadeddata', onCanPlay);
            video.addEventListener('error', onError);

            // Force load
            video.load();
          });

          // Now play
          await videoRef.current.play();
          setCameraState('active');
          setVideoReady(true);
          return; // Success
        }
      } catch (err: any) {
        lastError = err;
        // Clean up failed stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        // Continue to next constraint
      }
    }

    // All constraints failed
    if (lastError) {
      if (lastError.name === 'NotAllowedError' || lastError.name === 'PermissionDeniedError') {
        setCameraState('denied');
        setErrorMsg('Camera permission was denied. Please allow camera access in your browser settings and try again.');
      } else if (lastError.name === 'NotFoundError' || lastError.name === 'DevicesNotFoundError') {
        setCameraState('unsupported');
        setErrorMsg('No camera found on this device. Please use a device with a camera to complete verification.');
      } else if (lastError.name === 'NotReadableError' || lastError.name === 'TrackStartError') {
        setCameraState('error');
        setErrorMsg('Camera is being used by another application. Please close other apps and try again.');
      } else {
        setCameraState('error');
        setErrorMsg(lastError.message || 'Failed to access camera. Please try again.');
      }
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) {
      setErrorMsg('Camera not ready. Please try again.');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;

    canvas.width = videoWidth;
    canvas.height = videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setErrorMsg('Failed to process image. Please try again.');
      return;
    }

    // Draw mirrored image
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -videoWidth, 0, videoWidth, videoHeight);
    ctx.restore();

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        stopCamera();
      } else {
        setErrorMsg('Failed to capture image. Please try again.');
      }
    }, 'image/jpeg', 0.85);
  }, [onCapture, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Handle video events when stream is active
  useEffect(() => {
    const video = videoRef.current;
    if (!video || cameraState !== 'active') return;

    const handlePlaying = () => setVideoReady(true);
    const handlePause = () => {
      // Auto-restart if paused unexpectedly
      if (streamRef.current && cameraState === 'active') {
        video.play().catch(() => {});
      }
    };

    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
    };
  }, [cameraState]);

  const handleRetry = () => {
    stopCamera();
    startCamera();
  };

  if (image) {
    return (
      <div className="relative group">
        <img src={image} alt="Selfie" className="w-full max-h-64 object-contain rounded-xl border border-white/[0.06] bg-ink-900" />
        <button
          onClick={() => { onClear(); }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-error-500/80 hover:bg-error-500 text-white grid place-items-center transition-colors"
        >
          <XCircle size={16} />
        </button>
        <div className="absolute bottom-2 left-2 right-2 text-center">
          <span className="text-xs bg-success-500/80 text-white px-2 py-1 rounded">Selfie captured successfully</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <canvas ref={canvasRef} className="hidden" />

      {/* Video element always rendered when camera is active or requesting */}
      {(cameraState === 'requesting' || cameraState === 'active') && (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            disablePictureInPicture
            controls={false}
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {/* Loading overlay until video is ready */}
          {!videoReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-gold-400 mx-auto" />
                <p className="mt-2 text-sm text-gray-300">Starting camera...</p>
              </div>
            </div>
          )}
          {videoReady && (
            <>
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-4 rounded-full border-2 border-gold-400/40" />
              </div>
              <div className="absolute bottom-3 left-3 right-3 text-center">
                <span className="text-xs bg-black/60 text-white px-3 py-1 rounded-full">Position your face in the circle</span>
              </div>
            </>
          )}
        </div>
      )}

      {cameraState === 'idle' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-20 h-20 rounded-full bg-gold-400/10 grid place-items-center">
            <Camera size={32} className="text-gold-400" />
          </div>
          <p className="text-sm text-gray-400 text-center">Take a selfie to verify your identity. Make sure your face is clearly visible.</p>
          <button onClick={startCamera} className="btn-gold inline-flex items-center gap-2 px-8 py-3">
            <Camera size={20} /> Take Selfie
          </button>
        </div>
      )}

      {cameraState === 'requesting' && (
        <div className="flex gap-3">
          <button disabled className="btn-gold inline-flex items-center gap-2 flex-1 justify-center py-3 opacity-50">
            <Loader2 size={18} className="animate-spin" /> Starting...
          </button>
          <button onClick={stopCamera} className="btn-ghost inline-flex items-center gap-2 py-3">
            Cancel
          </button>
        </div>
      )}

      {cameraState === 'active' && videoReady && (
        <div className="flex gap-3">
          <button
            onClick={capturePhoto}
            className="btn-gold inline-flex items-center gap-2 flex-1 justify-center py-3"
          >
            <Camera size={18} /> Capture Selfie
          </button>
          <button onClick={stopCamera} className="btn-ghost inline-flex items-center gap-2 py-3">
            Cancel
          </button>
        </div>
      )}

      {(cameraState === 'denied' || cameraState === 'unsupported' || cameraState === 'error') && (
        <div className="rounded-xl border border-error-500/30 bg-error-500/10 p-6 text-center">
          <AlertCircle className="text-error-400 mx-auto mb-3" size={32} />
          <p className="text-sm text-gray-300 mb-1">Camera Access Issue</p>
          <p className="text-xs text-gray-500 mb-4">{errorMsg}</p>
          {cameraState !== 'unsupported' && (
            <button onClick={handleRetry} className="btn-gold inline-flex items-center gap-2 text-sm">
              <RefreshCw size={14} /> Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Review Item Component
// ============================================================
function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 border border-white/[0.04]">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-white mt-1">{value || '—'}</p>
    </div>
  );
}

// ============================================================
// Review Image Component
// ============================================================
function ReviewImage({ label, image }: { label: string; image: string | null }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {image ? (
        <img src={image} alt={label} className="w-full h-24 object-cover rounded-lg border border-white/[0.06]" />
      ) : (
        <div className="w-full h-24 rounded-lg border border-dashed border-white/[0.1] grid place-items-center">
          <ImageIcon size={20} className="text-gray-600" />
        </div>
      )}
    </div>
  );
}
