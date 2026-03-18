import { supabase } from '@/integrations/supabase/client';

interface SumUpCheckoutParams {
  amount: number;
  description?: string;
  customer_email?: string;
  customer_name?: string;
  reference?: string;
  redirect_url?: string;
}

interface SumUpCheckoutResult {
  checkout_id: string;
  checkout_url: string;
  amount: number;
  status: string;
}

export async function createSumUpCheckout(params: SumUpCheckoutParams): Promise<SumUpCheckoutResult> {
  const { data, error } = await supabase.functions.invoke('sumup-checkout', {
    body: params,
  });

  if (error) throw new Error(error.message || 'Erro ao criar checkout SumUp');
  if (data?.error) throw new Error(data.error);
  return data as SumUpCheckoutResult;
}
