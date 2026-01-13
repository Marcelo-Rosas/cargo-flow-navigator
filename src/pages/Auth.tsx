import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Package, Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const emailSchema = z.string().email('E-mail inválido');
const passwordSchema = z.string().min(8, 'A senha deve ter no mínimo 8 caracteres');

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, signIn, signUp } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      const from = (location.state as { from?: Location })?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, location.state]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate inputs
    const emailResult = emailSchema.safeParse(loginEmail);
    if (!emailResult.success) {
      setError(emailResult.error.errors[0].message);
      return;
    }

    const passwordResult = passwordSchema.safeParse(loginPassword);
    if (!passwordResult.success) {
      setError(passwordResult.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    
    const { error } = await signIn(loginEmail, loginPassword);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('E-mail ou senha incorretos');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Por favor, confirme seu e-mail antes de entrar');
      } else {
        setError(error.message);
      }
      setIsLoading(false);
      return;
    }
    
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate inputs
    if (!firstName.trim() || !lastName.trim()) {
      setError('Nome e sobrenome são obrigatórios');
      return;
    }

    const emailResult = emailSchema.safeParse(signupEmail);
    if (!emailResult.success) {
      setError(emailResult.error.errors[0].message);
      return;
    }

    const passwordResult = passwordSchema.safeParse(signupPassword);
    if (!passwordResult.success) {
      setError(passwordResult.error.errors[0].message);
      return;
    }

    if (!termsAccepted) {
      setError('Você precisa aceitar os termos de uso');
      return;
    }

    setIsLoading(true);
    
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const { error } = await signUp(signupEmail, signupPassword, fullName);
    
    if (error) {
      if (error.message.includes('User already registered')) {
        setError('Este e-mail já está cadastrado. Tente fazer login.');
      } else if (error.message.includes('Password should be at least')) {
        setError('A senha deve ter no mínimo 8 caracteres');
      } else {
        setError(error.message);
      }
      setIsLoading(false);
      return;
    }
    
    setSuccess('Conta criada! Verifique seu e-mail para confirmar o cadastro.');
    setIsLoading(false);
    
    // Clear form
    setFirstName('');
    setLastName('');
    setCompany('');
    setSignupEmail('');
    setSignupPassword('');
    setTermsAccepted(false);
  };

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <motion.div 
        className="hidden lg:flex lg:w-1/2 bg-sidebar relative overflow-hidden"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Background Pattern */}
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

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sidebar-primary flex items-center justify-center">
              <Package className="w-7 h-7 text-sidebar-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-2xl text-sidebar-foreground">Vectra</span>
              <span className="font-bold text-2xl text-sidebar-muted"> Cargo</span>
            </div>
          </div>

          {/* Hero Text */}
          <div className="max-w-md">
            <motion.h1 
              className="text-4xl font-bold text-sidebar-foreground leading-tight"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Gerencie suas operações de transporte em um só lugar
            </motion.h1>
            <motion.p 
              className="mt-4 text-lg text-sidebar-muted"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              Do comercial ao operacional, integre cotações, ordens de serviço e documentos com automação inteligente.
            </motion.p>

            {/* Features List */}
            <motion.ul 
              className="mt-8 space-y-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {[
                'Pipeline comercial integrado',
                'Gestão de ordens de serviço',
                'Controle documental (NF-e, CT-e, POD)',
                'Rastreamento em tempo real',
              ].map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sidebar-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                  {feature}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* Footer */}
          <p className="text-sm text-sidebar-muted">
            © 2024 Vectra Cargo. Todos os direitos reservados.
          </p>
        </div>
      </motion.div>

      {/* Right Panel - Auth Form */}
      <motion.div 
        className="flex-1 flex items-center justify-center p-8 bg-background"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Package className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-xl text-foreground">Vectra</span>
              <span className="font-bold text-xl text-muted-foreground"> Cargo</span>
            </div>
          </div>

          {/* Error/Success Alerts */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mb-6 border-green-500 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="login" className="w-full" onValueChange={() => { setError(null); setSuccess(null); }}>
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Bem-vindo de volta
                </h2>
                <p className="text-muted-foreground mb-8">
                  Entre com suas credenciais para acessar o sistema
                </p>

                <form onSubmit={handleLogin} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com.br"
                        className="pl-10"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Senha</Label>
                      <Button variant="link" className="p-0 h-auto text-sm">
                        Esqueceu a senha?
                      </Button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="pl-10 pr-10"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="remember" />
                    <Label htmlFor="remember" className="text-sm font-normal">
                      Manter conectado
                    </Label>
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                    {isLoading ? 'Entrando...' : 'Entrar'}
                    {!isLoading && <ArrowRight className="w-4 h-4" />}
                  </Button>
                </form>
              </motion.div>
            </TabsContent>

            {/* Signup Tab */}
            <TabsContent value="signup">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  Crie sua conta
                </h2>
                <p className="text-muted-foreground mb-8">
                  Preencha os dados para começar a usar o sistema
                </p>

                <form onSubmit={handleSignup} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Nome</Label>
                      <Input 
                        id="firstName" 
                        placeholder="João" 
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Sobrenome</Label>
                      <Input 
                        id="lastName" 
                        placeholder="Silva" 
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Empresa</Label>
                    <Input 
                      id="company" 
                      placeholder="Transportadora ABC" 
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signupEmail">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signupEmail"
                        type="email"
                        placeholder="seu@email.com.br"
                        className="pl-10"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signupPassword">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signupPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 8 caracteres"
                        className="pl-10 pr-10"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox 
                      id="terms" 
                      className="mt-0.5" 
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    />
                    <Label htmlFor="terms" className="text-sm font-normal">
                      Concordo com os{' '}
                      <Button variant="link" className="p-0 h-auto text-sm">
                        Termos de Uso
                      </Button>{' '}
                      e{' '}
                      <Button variant="link" className="p-0 h-auto text-sm">
                        Política de Privacidade
                      </Button>
                    </Label>
                  </div>

                  <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                    {isLoading ? 'Criando conta...' : 'Criar conta'}
                    {!isLoading && <ArrowRight className="w-4 h-4" />}
                  </Button>
                </form>
              </motion.div>
            </TabsContent>
          </Tabs>
        </div>
      </motion.div>
    </div>
  );
}
