import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Building2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useCompanySettings, useUpdateCompanySettings } from '@/hooks/useCompanySettings';
import { MainLayout } from '@/components/layout/MainLayout';

const schema = z.object({
  legal_name: z.string().min(2, 'Razão social obrigatória'),
  trade_name: z.string().optional().default(''),
  cnpj: z.string().min(14, 'CNPJ inválido'),
  state_registration: z.string().optional().default(''),
  municipal_registration: z.string().optional().default(''),
  address_street: z.string().min(2, 'Logradouro obrigatório'),
  address_number: z.string().min(1, 'Número obrigatório'),
  address_complement: z.string().optional().default(''),
  address_neighborhood: z.string().optional().default(''),
  address_city: z.string().min(2, 'Cidade obrigatória'),
  address_state: z.string().length(2, 'Use a sigla do estado (ex: SC)'),
  address_zip: z.string().min(8, 'CEP inválido'),
  legal_representative_name: z.string().optional().default(''),
  legal_representative_cpf: z.string().optional().default(''),
  legal_representative_role: z.string().optional().default(''),
  bank_name: z.string().optional().default(''),
  bank_agency: z.string().optional().default(''),
  bank_account: z.string().optional().default(''),
  bank_pix_key: z.string().optional().default(''),
  default_jurisdiction: z.string().optional().default('Navegantes/SC'),
  signature_city: z.string().optional().default('Navegantes'),
});

type FormData = z.infer<typeof schema>;

export default function CompanySettings() {
  const { data: settings, isLoading } = useCompanySettings();
  const updateMutation = useUpdateCompanySettings();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      legal_name: '',
      trade_name: '',
      cnpj: '',
      state_registration: '',
      municipal_registration: '',
      address_street: '',
      address_number: '',
      address_complement: '',
      address_neighborhood: '',
      address_city: '',
      address_state: '',
      address_zip: '',
      legal_representative_name: '',
      legal_representative_cpf: '',
      legal_representative_role: '',
      bank_name: '',
      bank_agency: '',
      bank_account: '',
      bank_pix_key: '',
      default_jurisdiction: 'Navegantes/SC',
      signature_city: 'Navegantes',
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        legal_name: settings.legal_name ?? '',
        trade_name: settings.trade_name ?? '',
        cnpj: settings.cnpj ?? '',
        state_registration: settings.state_registration ?? '',
        municipal_registration: settings.municipal_registration ?? '',
        address_street: settings.address_street ?? '',
        address_number: settings.address_number ?? '',
        address_complement: settings.address_complement ?? '',
        address_neighborhood: settings.address_neighborhood ?? '',
        address_city: settings.address_city ?? '',
        address_state: settings.address_state ?? '',
        address_zip: settings.address_zip ?? '',
        legal_representative_name: settings.legal_representative_name ?? '',
        legal_representative_cpf: settings.legal_representative_cpf ?? '',
        legal_representative_role: settings.legal_representative_role ?? '',
        bank_name: settings.bank_name ?? '',
        bank_agency: settings.bank_agency ?? '',
        bank_account: settings.bank_account ?? '',
        bank_pix_key: settings.bank_pix_key ?? '',
        default_jurisdiction: settings.default_jurisdiction ?? 'Navegantes/SC',
        signature_city: settings.signature_city ?? 'Navegantes',
      });
    }
  }, [settings, form]);

  const onSubmit = async (data: FormData) => {
    if (!settings?.id) {
      toast.error('Configurações não encontradas');
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: settings.id, ...data });
      toast.success('Configurações salvas');
    } catch {
      toast.error('Erro ao salvar configurações');
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Dados da Empresa</h1>
            <p className="text-sm text-muted-foreground">
              Informações usadas na geração automática de contratos
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Identificação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="legal_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razão Social *</FormLabel>
                        <FormControl>
                          <Input placeholder="Empresa LTDA" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="trade_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Fantasia</FormLabel>
                        <FormControl>
                          <Input placeholder="Vectra Cargo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ *</FormLabel>
                        <FormControl>
                          <Input placeholder="00.000.000/0000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="state_registration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inscrição Estadual</FormLabel>
                        <FormControl>
                          <Input placeholder="Isento" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="municipal_registration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Inscrição Municipal</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Endereço</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="address_street"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Logradouro *</FormLabel>
                          <FormControl>
                            <Input placeholder="Avenida Principal" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="address_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número *</FormLabel>
                        <FormControl>
                          <Input placeholder="495" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="address_complement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input placeholder="Sala 1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address_neighborhood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input placeholder="São Pedro" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <FormField
                      control={form.control}
                      name="address_city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade *</FormLabel>
                          <FormControl>
                            <Input placeholder="Navegantes" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="address_state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="SC"
                            maxLength={2}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address_zip"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP *</FormLabel>
                        <FormControl>
                          <Input placeholder="88.370-053" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Representante Legal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="legal_representative_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome completo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="legal_representative_cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input placeholder="000.000.000-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="legal_representative_role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo / Função</FormLabel>
                      <FormControl>
                        <Input placeholder="Sócio-Gerente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados Bancários</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name="bank_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Banco</FormLabel>
                          <FormControl>
                            <Input placeholder="336 – Banco C6 S.A." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="bank_agency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agência</FormLabel>
                        <FormControl>
                          <Input placeholder="0001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bank_account"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conta Corrente</FormLabel>
                        <FormControl>
                          <Input placeholder="00000000-0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bank_pix_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chave PIX</FormLabel>
                        <FormControl>
                          <Input placeholder="CNPJ ou e-mail" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contrato</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="default_jurisdiction"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Foro</FormLabel>
                        <FormControl>
                          <Input placeholder="Navegantes/SC" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="signature_city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade de assinatura</FormLabel>
                        <FormControl>
                          <Input placeholder="Navegantes" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div className="flex justify-end">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar Configurações
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </MainLayout>
  );
}
