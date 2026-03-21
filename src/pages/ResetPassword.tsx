import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type PageState = 'loading' | 'ready' | 'success' | 'error';

export default function ResetPassword() {
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Wait for Supabase to process the hash fragment (#access_token=...)
  // and fire the PASSWORD_RECOVERY event
  useEffect(() => {
    let settled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (settled) return;

      if (event === 'PASSWORD_RECOVERY') {
        settled = true;
        setPageState('ready');
      }
    });

    // Also check if there's already a session (user might have refreshed the page
    // after the recovery event already fired)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (settled) return;

      if (session) {
        // Session exists — allow password update
        settled = true;
        setPageState('ready');
      }
    });

    // Timeout: if no recovery event after 5s, something went wrong
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        setPageState('error');
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsSubmitting(false);

    if (error) {
      toast.error('Erro ao atualizar senha. O link pode ter expirado. Solicite um novo.');
      return;
    }

    setPageState('success');
    toast.success('Senha atualizada com sucesso!');
  };

  const handleGoToApp = () => {
    navigate('/', { replace: true });
  };

  const handleGoToLogin = () => {
    navigate('/auth', { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding (same as Auth page) */}
      <motion.div
        className="hidden lg:flex lg:w-1/2 bg-sidebar relative overflow-hidden"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute rounded-full bg-sidebar-primary"
                style={{
                  width: Math.random() * 300 + 50,
                  height: Math.random() * 300 + 50,
                  top: `${Math.random() * 100}%`,
                  left: `${Math.random() * 100}%`,
                  opacity: Math.random() * 0.5,
                }}
              />
            ))}
          </div>
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div className="flex items-center gap-3">
            <BrandLogo size="lg" iconWrapClassName="bg-sidebar-primary" />
          </div>

          <div className="max-w-md">
            <motion.h1
              className="text-4xl font-bold text-sidebar-foreground leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Recuperação de Senha
            </motion.h1>
            <motion.p
              className="mt-4 text-lg text-sidebar-muted"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Defina uma nova senha segura para acessar sua conta.
            </motion.p>
          </div>

          <p className="text-sm text-sidebar-muted">
            &copy; 2024 Vectra Cargo. Todos os direitos reservados.
          </p>
        </div>
      </motion.div>

      {/* Right Panel - Reset Form */}
      <motion.div
        className="flex-1 flex items-center justify-center p-8 bg-background"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <BrandLogo
              size="md"
              iconWrapClassName="bg-primary"
              textPrimaryClassName="text-foreground"
              textSecondaryClassName="text-muted-foreground"
            />
          </div>

          {/* Loading State */}
          {pageState === 'loading' && (
            <motion.div
              className="text-center space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="text-muted-foreground">Validando link de recuperação...</p>
            </motion.div>
          )}

          {/* Error State */}
          {pageState === 'error' && (
            <motion.div
              className="text-center space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Link inválido ou expirado</h2>
              <p className="text-muted-foreground">
                O link de recuperação expirou ou já foi utilizado. Solicite um novo link na página
                de login.
              </p>
              <Button onClick={handleGoToLogin} className="gap-2">
                Voltar ao Login
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* Success State */}
          {pageState === 'success' && (
            <motion.div
              className="text-center space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Senha atualizada!</h2>
              <p className="text-muted-foreground">
                Sua senha foi alterada com sucesso. Você já está autenticado.
              </p>
              <Button onClick={handleGoToApp} className="gap-2">
                Acessar o Sistema
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>
          )}

          {/* Password Form */}
          {pageState === 'ready' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="text-2xl font-bold text-foreground mb-2">Definir Nova Senha</h2>
              <p className="text-muted-foreground mb-8">
                Escolha uma nova senha segura para sua conta.
              </p>

              <form onSubmit={handleUpdatePassword} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      className="pl-10 pr-10"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoFocus
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Repita a senha"
                      className="pl-10"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Password strength hint */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className={newPassword.length >= 6 ? 'text-emerald-600' : ''}>
                    {newPassword.length >= 6 ? '✓' : '○'} Mínimo 6 caracteres
                  </p>
                  <p
                    className={
                      newPassword && confirmPassword && newPassword === confirmPassword
                        ? 'text-emerald-600'
                        : ''
                    }
                  >
                    {newPassword && confirmPassword && newPassword === confirmPassword ? '✓' : '○'}{' '}
                    Senhas coincidem
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={
                    isSubmitting || newPassword.length < 6 || newPassword !== confirmPassword
                  }
                >
                  {isSubmitting ? 'Atualizando...' : 'Atualizar Senha'}
                  {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                <Button variant="link" className="p-0 h-auto text-sm" onClick={handleGoToLogin}>
                  Voltar ao login
                </Button>
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
