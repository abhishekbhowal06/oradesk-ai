import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logoIcon from '@/assets/dentacor-logo-icon.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, Sparkles, ShieldCheck, Terminal, Cpu, Radio, Zap, Activity, Box } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Login() {
  const navigate = useNavigate();
  const {
    signIn,
    signUp,
    signInWithMagicLink,
    isAuthenticated,
    isLoading: authLoading,
  } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'ACCESS_DENIED', description: 'CREDENTIALS_REQUIRED_FOR_ENTRY.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'PROTOCOL_FAILURE',
        description: error.message || 'INVALID_IDENTITY_PACKET.',
        variant: 'destructive',
      });
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) {
      toast({ title: 'ERROR', description: 'ALL_FIELDS_MANDATORY_FOR_REGISTRATION.', variant: 'destructive' });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'WEAK_ENTROPY',
        description: 'PASSPHRASE_MUST_EXCEED_6_CHARS.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error: signUpError, session } = await signUp(email, password, fullName);
      if (signUpError) throw signUpError;

      // If email verification is disabled, this will automatically log them in
      // Let's attempt signin just to ensure local session state is correct if needed
      if (!session) {
        await signIn(email, password);
      }

      toast({
        title: 'IDENTITY_ENROLLED',
        description: 'WELCOME_TO_DENTACOR_ECOSYSTEM.',
      });
      navigate('/', { replace: true });
    } catch (err: any) {
      toast({
        title: 'PROVISION_FAILURE',
        description: err.message || 'UNABLE_TO_ENROLL_NEW_IDENTITY.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!magicLinkEmail) {
      toast({ title: 'ERROR', description: 'EMAIL_REQUIRED_FOR_UPLINK.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const { error } = await signInWithMagicLink(magicLinkEmail);
    setIsLoading(false);

    if (error) {
      toast({
        title: 'UPLINK_FAILURE',
        description: error.message || 'UNABLE_TO_BROADCAST_MAGIC_LINK.',
        variant: 'destructive',
      });
    } else {
      setMagicLinkSent(true);
      toast({
        title: 'BROADCAST_SUCCESS',
        description: 'CHECK_INBOX_FOR_AUTHENTICATION_PACKET.',
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#051a1e] font-mono">
        <Activity className="h-12 w-12 animate-pulse text-primary mb-6" />
        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white">Initializing_Secure_Nexus...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 font-mono overflow-hidden relative">

      {/* Background Graphic Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] z-0" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-stripe-pattern z-0" />

      {/* Dynamic Scanline */}
      <div className="absolute top-0 left-0 w-full h-[2px] bg-primary/20 shadow-[0_0_20px_#f59e0b] animate-scanline z-0 pointer-events-none" />

      <div className="w-full max-w-lg space-y-10 relative z-10">

        {/* Logo and Brand */}
        <div className="flex flex-col items-center space-y-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full group-hover:bg-primary/40 transition-all duration-700" />
            <div className="h-24 w-24 border-2 border-primary/40 bg-[#051a1e] flex items-center justify-center relative rotate-45 group-hover:rotate-90 transition-transform duration-1000">
              <img src={logoIcon} alt="DENTACOR" className="h-16 w-16 object-contain -rotate-45 group-hover:-rotate-90 transition-transform duration-1000 contrast-125" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-primary border-2 border-black p-1">
              <ShieldCheck className="h-4 w-4 text-black" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
              Denta<span className="text-primary/80">cor</span>
            </h1>
            <div className="flex items-center justify-center gap-3">
              <div className="h-px w-8 bg-white/10" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em]">Autonomous_OS_Core // v4.0</p>
              <div className="h-px w-8 bg-white/10" />
            </div>
          </div>
        </div>

        {/* Global Terminal Container */}
        <div className="bg-[#051a1e] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden relative">

          {/* Header Bar */}
          <div className="bg-white/5 border-b border-white/10 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Terminal className="h-4 w-4 text-primary" />
              <span className="text-[9px] font-bold text-white uppercase tracking-widest">Access_Control_Terminal_A1</span>
            </div>
            <div className="flex gap-1.5 font-bold">
              <div className="w-2 h-2 bg-emerald-500 animate-pulse" />
              <div className="w-2 h-2 bg-primary/20" />
              <div className="w-2 h-2 bg-primary/20" />
            </div>
          </div>

          <div className="p-10">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-10 bg-black/40 border border-white/5 p-1 rounded-none h-12">
                <TabsTrigger value="signin" className="rounded-none font-bold text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-black transition-all">Identity</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-none font-bold text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-black transition-all">Enroll</TabsTrigger>
                <TabsTrigger value="magic" className="rounded-none font-bold text-[10px] uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-black transition-all">Uplink</TabsTrigger>
              </TabsList>

              {/* Sign In Tab */}
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-8">
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label htmlFor="signin-email" className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        Auth_Email
                      </Label>
                      <Input
                        id="signin-email"
                        type="email"
                        autoComplete="email"
                        placeholder="doctor@clinic.sys"
                        className="h-12 bg-black/60 border-white/10 focus:border-primary/50 text-[11px] font-bold uppercase tracking-widest text-white rounded-none transition-all placeholder:opacity-20"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password" className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                          <Lock className="h-3 w-3" />
                          Security_Key
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            if (!email) {
                              toast({ title: 'ERROR', description: 'IDENTITY_EMAIL_REQUIRED.', variant: 'destructive' });
                              return;
                            }
                            setIsLoading(true);
                            fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/v1/auth/forgot-password`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ email }),
                            })
                              .then((res) => {
                                if (res.ok) toast({ title: 'UPLINK_SUCCESS', description: 'RECOVERY_PACKET_DISPATCHED.' });
                                else toast({ title: 'ERROR', description: 'RECOVERY_FAULT.', variant: 'destructive' });
                              })
                              .finally(() => setIsLoading(false));
                          }}
                          className="text-[8px] text-muted-foreground hover:text-primary uppercase tracking-widest animate-pulse transition-colors"
                        >
                          Recover_Access?
                        </button>
                      </div>
                      <Input
                        id="signin-password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="h-12 bg-black/60 border-white/10 focus:border-primary/50 text-[11px] font-bold uppercase tracking-widest text-white rounded-none transition-all placeholder:opacity-40"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="btn-gold w-full h-14 font-black text-[12px] uppercase tracking-[0.3em] rounded-none group relative overflow-hidden" disabled={isLoading}>
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShieldCheck className="h-5 w-5" />}
                      {isLoading ? 'VERIFYING...' : 'INITIATE_SESSION'}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  </Button>
                </form>
              </TabsContent>

              {/* Sign Up Tab */}
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-6">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-[9px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                        <User className="h-3 w-3" />
                        Full_Name
                      </Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Dr. Alexander Wright"
                        className="h-10 bg-black/60 border-white/10 focus:border-primary/50 text-[10px] font-bold uppercase tracking-widest text-white rounded-none"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-[9px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        Register_Email
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="chief@dental.hq"
                        className="h-10 bg-black/60 border-white/10 focus:border-primary/50 text-[10px] font-bold uppercase tracking-widest text-white rounded-none"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-[9px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                        <Lock className="h-3 w-3" />
                        Secure_Key_Config
                      </Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="Min 6 characters"
                        className="h-10 bg-black/60 border-white/10 focus:border-primary/50 text-[10px] font-bold uppercase tracking-widest text-white rounded-none"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="btn-gold w-full h-14 font-black text-[11px] uppercase tracking-[0.2em] rounded-none group relative overflow-hidden" disabled={isLoading}>
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Cpu className="h-5 w-5" />}
                      {isLoading ? 'ENROLLING...' : 'ENROLL_ENTITY'}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  </Button>
                </form>
              </TabsContent>

              {/* Magic Link Tab */}
              <TabsContent value="magic">
                {magicLinkSent ? (
                  <div className="text-center py-10 space-y-6 animate-in zoom-in-95 duration-500">
                    <div className="mx-auto w-20 h-20 border-2 border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center">
                      <Mail className="h-10 w-10 text-emerald-500 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Broadcast_Complete</h3>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
                        Secured packet dispatched to:<br />
                        <span className="text-primary">{magicLinkEmail}</span>
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      className="text-[9px] text-primary uppercase font-bold tracking-widest hover:bg-white/5 rounded-none"
                      onClick={() => setMagicLinkSent(false)}
                    >
                      &gt; RE-ATTEMPT_BROADCAST
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleMagicLink} className="space-y-8">
                    <div className="space-y-3">
                      <Label htmlFor="magic-email" className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                        <Radio className="h-3 w-3 animate-pulse" />
                        Target_Frequency_Email
                      </Label>
                      <Input
                        id="magic-email"
                        type="email"
                        placeholder="doctor@clinic.sys"
                        className="h-12 bg-black/60 border-white/10 focus:border-primary/50 text-[11px] font-bold uppercase tracking-widest text-white rounded-none transition-all placeholder:opacity-20"
                        value={magicLinkEmail}
                        onChange={(e) => setMagicLinkEmail(e.target.value)}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="bg-primary/5 border border-primary/20 p-4">
                      <p className="text-[9px] text-primary/80 font-bold uppercase tracking-[0.2em] leading-relaxed">
                        NOTICE:: Automated passwordless handshake. A cryptographically secure session link will be broadcast to the target address.
                      </p>
                    </div>

                    <Button type="submit" className="btn-gold w-full h-14 font-black text-[12px] uppercase tracking-[0.3em] rounded-none group relative overflow-hidden" disabled={isLoading}>
                      <span className="relative z-10 flex items-center justify-center gap-3">
                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                        {isLoading ? 'BROADCASTING...' : 'INITIATE_HANDSHAKE'}
                      </span>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                    </Button>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer Grid Info */}
          <div className="bg-white/5 border-t border-white/10 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest opacity-80">Encryption: AES_256_GCM</span>
            </div>
            <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">©2026_NEURAL_INFRA</span>
          </div>
        </div>

        {/* Tactical Info Footer */}
        <div className="flex flex-col items-center gap-4 py-6 border-t border-white/5 mx-auto w-fit px-10">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Global_Relay::OK</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Sync_Status::LOCKED</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Node_A1::LISTENING</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Grid Corner */}
      <div className="absolute top-0 left-0 p-10 opacity-5">
        <Box className="h-64 w-64" />
      </div>

      <style>{`
        @keyframes scanline {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scanline {
          animation: scanline 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
